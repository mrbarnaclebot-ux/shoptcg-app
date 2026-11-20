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
  priceSchema,
} from "@/lib/listing-input";
import {
  addCatalogListing,
  addCustomListing,
  countListings,
  importListings,
  ListingError,
  PAGE_ROWS,
  removeListings,
  restoreListings,
  setActive,
  setPrices,
  stepQty,
  setListingPhoto,
  updateListing,
  type RemoveResult,
} from "@/lib/listings";
import { photoAllowed } from "@/lib/export-limit";
import { dropImage, putImage, type StoredImage } from "@/lib/image-store";
import { defaultProvider } from "@/lib/pricing/provider";
import { ImageError, processPhoto } from "@/lib/store-image";
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

// One row's id, or the rows a vendor ticked: never more than one page shows.
const idsSchema = z.array(z.uuid()).min(1).max(PAGE_ROWS);

/** Without `force`, stops at { held } when buyers have one, so the vendor can be asked first. */
export async function removeAction(
  ids: string[],
  force: boolean,
): Promise<RemoveResult | { error: string }> {
  const { store } = await requireStore();
  try {
    const res = await removeListings(
      getDb(),
      store.id,
      idsSchema.parse(ids),
      force === true,
    );
    if ("ok" in res) refresh();
    return res;
  } catch (err) {
    console.error("[inventory] remove failed", err);
    return { error: SAVE_FAILED };
  }
}

export async function restoreAction(ids: string[]): Promise<Result> {
  const { store } = await requireStore();
  try {
    const n = await restoreListings(getDb(), store.id, idsSchema.parse(ids));
    if (!n) return { error: "That item is not in your removed stock." };
  } catch (err) {
    if (err instanceof ListingError) return { error: err.message };
    console.error("[inventory] restore failed", err);
    return { error: SAVE_FAILED };
  }
  refresh();
  return {};
}

/** Hides (false) or shows the ticked rows. */
export async function showAction(
  ids: string[],
  active: boolean,
): Promise<Result> {
  const { store } = await requireStore();
  try {
    await setActive(getDb(), store.id, idsSchema.parse(ids), active === true);
  } catch (err) {
    if (err instanceof ListingError) return { error: err.message };
    console.error("[inventory] show failed", err);
    return { error: SAVE_FAILED };
  }
  refresh();
  return {};
}

/** One fixed price on the ticked rows, or blank to follow the market again. */
export async function setPriceAction(
  ids: string[],
  price: string,
): Promise<Result> {
  const { store } = await requireStore();
  const parsed = priceSchema.safeParse(price);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await setPrices(getDb(), store.id, idsSchema.parse(ids), parsed.data);
  } catch (err) {
    console.error("[inventory] set price failed", err);
    return { error: SAVE_FAILED };
  }
  refresh();
  return {};
}

/**
 * The form's photo, re-encoded and stored: null when none was picked, or the
 * message to show when it can't be used.
 */
async function storePhoto(
  store: { id: string; slug: string },
  file: FormDataEntryValue | null,
): Promise<StoredImage | null | string> {
  if (!(file instanceof File) || !file.size) return null;
  if (!photoAllowed(store.id)) return "Too many photos. Try again in an hour.";
  try {
    const bytes = await processPhoto(new Uint8Array(await file.arrayBuffer()));
    return await putImage(bytes, `${store.slug}-item.webp`);
  } catch (err) {
    if (err instanceof ImageError) return err.message;
    console.error("[inventory] photo upload failed", err);
    return "Couldn't save that photo. Try again.";
  }
}

/** Sets (a "photo" file) or removes ("remove" = 1) a custom item's photo, from the edit panel. */
export async function setPhotoAction(form: FormData): Promise<Result> {
  const { store } = await requireStore();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { error: "That item is not in your stock." };
  const photo = await storePhoto(store, form.get("photo"));
  if (typeof photo === "string") return { error: photo };
  if (!photo && form.get("remove") !== "1")
    return { error: "Pick a photo first." };
  try {
    const old = await setListingPhoto(getDb(), store.id, id.data, photo);
    if (old === undefined) {
      await dropImage(photo?.fileId ?? null);
      return { error: "That item is not in your stock." };
    }
    if (old !== (photo?.fileId ?? null)) await dropImage(old);
  } catch (err) {
    await dropImage(photo?.fileId ?? null);
    console.error("[inventory] set photo failed", err);
    return { error: SAVE_FAILED };
  }
  refresh();
  return {};
}

export async function addCatalogAction(
  input: unknown,
): Promise<
  Result & Partial<Added> & { merged?: { from: number; to: number } | null }
> {
  const { store } = await requireStore();
  const parsed = catalogListingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const db = getDb();
    const row = await addCatalogListing(db, store.id, parsed.data);
    const { merged } = row;
    // Topped up a card already on the shelf: priced, and not the first.
    if (merged) return { id: row.id, first: false, merged };
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
  const photo = await storePhoto(store, form.get("photo"));
  if (typeof photo === "string") return { errors: { photo } };
  try {
    const db = getDb();
    const row = await addCustomListing(db, store.id, {
      ...parsed.data,
      ...(photo && { imageUrl: photo.url, imageFileId: photo.fileId }),
    }).catch(async (err) => {
      await dropImage(photo?.fileId ?? null);
      throw err;
    });
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
      // "other" never gets here (previewOne keeps it custom).
      {
        kind: input.kind === "other" ? "raw" : input.kind,
        language: input.language,
      },
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
    // Rows, not listings: some may have topped up cards already in stock.
    return { count: parsed.data.length };
  } catch (err) {
    if (err instanceof ListingError) return { error: err.message };
    console.error("[inventory] import failed", err);
    return { error: "Nothing was imported. Preview the file again and retry." };
  }
}
