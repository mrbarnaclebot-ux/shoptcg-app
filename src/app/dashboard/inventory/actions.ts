"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { chargeMiss, searchCatalog } from "@/lib/catalog";
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
  importListings,
  ListingError,
  stepQty,
  updateListing,
} from "@/lib/listings";
import { defaultProvider } from "@/lib/pricing/provider";
import { requireStore } from "@/lib/session";

// Every action resolves the store from the session; ids from the browser are
// only ever used together with that store id (see lib/listings.ts).

type Result = { error?: string };
const SAVE_FAILED = "Couldn't save that. Try again.";

export async function stepQtyAction(id: string, delta: 1 | -1) {
  const { store } = await requireStore();
  const qty = await stepQty(getDb(), store.id, z.uuid().parse(id), delta);
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

export async function addCatalogAction(input: unknown): Promise<Result> {
  const { store } = await requireStore();
  const parsed = catalogListingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await addCatalogListing(getDb(), store.id, parsed.data);
  } catch (err) {
    if (err instanceof ListingError) return { error: err.message };
    console.error("[inventory] add failed", err);
    return { error: SAVE_FAILED };
  }
  return {};
}

export type CustomState = {
  added?: string;
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
  await addCustomListing(getDb(), store.id, parsed.data);
  return { added: parsed.data.name, n: (prev.n ?? 0) + 1 };
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
  const rows = await previewRows(parsed, (input) =>
    searchCatalog(
      db,
      searchText(input),
      { kind: input.kind, language: input.language },
      provider,
      () => chargeMiss(db, user.id),
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
    const count = await importListings(getDb(), store.id, parsed.data);
    return { count };
  } catch (err) {
    console.error("[inventory] import failed", err);
    return { error: "Nothing was imported. Preview the file again and retry." };
  }
}
