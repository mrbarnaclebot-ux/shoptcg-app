"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import type { Db } from "@/db/open";
import { missLimit, searchCatalog } from "@/lib/catalog";
import {
  importRowsSchema,
  previewRows,
  readCsv,
  searchText,
  type PreviewRow,
} from "@/lib/csv-import";
import {
  catalogListingSchema,
  customListingSchema,
  fieldErrors,
  listingPatchSchema,
} from "@/lib/listing-input";
import {
  addCatalogListing,
  addCustomListing,
  countListings,
  importListings,
  ListingError,
  stepQty,
  updateListing,
} from "@/lib/listings";
import { defaultProvider } from "@/lib/pricing/provider";
import { addToTableSale } from "@/lib/requests";
import { requireStore } from "@/lib/session";
import { priceNewListings } from "@/lib/sync-prices";

// Every action resolves the store from the session; ids from the browser are
// only ever used together with that store id (see lib/listings.ts).

type Result = { error?: string };
/** The new listing's id and whether it was the store's first (the first gets the show moment). */
type Added = { id: string; first: boolean };
const SAVE_FAILED = "Couldn't save that. Try again.";

// The insert already succeeded; a failed count only loses the celebration.
async function isFirst(db: Db, storeId: string) {
  try {
    return (await countListings(db, storeId)) === 1;
  } catch (err) {
    console.error("[inventory] count failed", err);
    return false;
  }
}

const deltaSchema = z.union([z.literal(1), z.literal(-1)]);

/** Puts one on the table sale; false when none is free to sell. */
export async function sellAction(id: string) {
  const { store } = await requireStore();
  const sale = await addToTableSale(getDb(), store.id, z.uuid().parse(id));
  refresh();
  return Boolean(sale);
}

export async function stepQtyAction(id: string, delta: 1 | -1) {
  const { store } = await requireStore();
  const qty = await stepQty(
    getDb(),
    store.id,
    z.uuid().parse(id),
    deltaSchema.parse(delta),
  );
  refresh();
  return qty;
}

export async function updateListingAction(patch: unknown): Promise<Result> {
  const { store } = await requireStore();
  const parsed = listingPatchSchema.safeParse(patch);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const ok = await updateListing(getDb(), store.id, parsed.data);
    if (!ok) return { error: "That item is not in your stock." };
  } catch (err) {
    console.error("[inventory] update failed", err);
    return { error: SAVE_FAILED };
  }
  refresh();
  return {};
}

export async function addCatalogAction(
  input: unknown,
): Promise<Result & Partial<Added>> {
  const { store } = await requireStore();
  const parsed = catalogListingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const db = getDb();
    const row = await addCatalogListing(db, store.id, parsed.data);
    // After the response: the vendor doesn't wait on the price provider.
    // The row's own id: a picked grade made a new graded catalog row.
    after(() => priceNewListings(db, [row.catalogItemId!]));
    return { id: row.id, first: await isFirst(db, store.id) };
  } catch (err) {
    if (err instanceof ListingError) return { error: err.message };
    console.error("[inventory] add failed", err);
    return { error: SAVE_FAILED };
  }
}

export type CustomState = {
  added?: Added & {
    name: string;
    qty: number;
    price: number | null;
    condition: string | null;
  };
  // Bumped per success so the form remounts empty with its default choices.
  n?: number;
  errors?: Record<string, string>;
};

export async function addCustomAction(
  prev: CustomState,
  form: FormData,
): Promise<CustomState> {
  const { store } = await requireStore();
  const parsed = customListingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  try {
    const db = getDb();
    const row = await addCustomListing(db, store.id, parsed.data);
    const first = await isFirst(db, store.id);
    const { name, qty, overridePrice, condition } = parsed.data;
    const price = overridePrice ? Number(overridePrice) : null;
    const added = { id: row.id, first, name, qty, price, condition };
    return { added, n: (prev.n ?? 0) + 1 };
  } catch (err) {
    if (err instanceof ListingError) return { errors: { form: err.message } };
    console.error("[inventory] add custom failed", err);
    return { errors: { form: SAVE_FAILED } };
  }
}

export async function previewCsvAction(
  text: unknown,
): Promise<{ rows?: PreviewRow[]; error?: string }> {
  const { user } = await requireStore();
  const csv = z.string().max(1_000_000).safeParse(text);
  if (!csv.success)
    return { error: "That file is too big. Keep it under 1 MB." };
  let parsed;
  try {
    parsed = readCsv(csv.data);
  } catch (err) {
    return { error: (err as Error).message };
  }
  const db = getDb();
  const provider = defaultProvider();
  const limit = missLimit(db, user.id);
  const rows = await previewRows(parsed, (input) =>
    searchCatalog(
      db,
      searchText(input),
      { kind: input.kind, language: input.language },
      provider,
      limit,
    ),
  );
  return { rows };
}

export async function importCsvAction(
  rows: unknown,
): Promise<{ count?: number; error?: string }> {
  const { store } = await requireStore();
  const parsed = importRowsSchema.safeParse(rows);
  if (!parsed.success)
    return { error: "Some rows changed. Preview the file again." };
  try {
    const db = getDb();
    const added = await importListings(db, store.id, parsed.data);
    // The listings' own ids: a slab row points at its graded catalog row.
    const ids = added.flatMap((r) => r.catalogItemId ?? []);
    after(() => priceNewListings(db, ids));
    return { count: added.length };
  } catch (err) {
    if (err instanceof ListingError) return { error: err.message };
    console.error("[inventory] import failed", err);
    return { error: "Nothing was imported. Preview the file again and retry." };
  }
}
