import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type Column,
} from "drizzle-orm";
import type { Db } from "@/db/open";
import { catalogItem, listing, pricePoint, store } from "@/db/schema";
import { gradedItem } from "@/lib/catalog";
import type {
  CatalogListingInput,
  CustomListingInput,
  ListingPatch,
} from "@/lib/listing-input";

// Every function takes the caller's storeId and filters on it: that filter is
// the ownership check, so a listing id from another store matches nothing.

export type StockFilter = {
  q?: string;
  kind?: "raw" | "graded" | "sealed" | "other" | "hidden";
  language?: "en" | "ja" | "zh";
  /** Any of these languages (the public page's multi-select chips). */
  languages?: ("en" | "ja" | "zh")[];
  /** One listing, for the public item page. */
  id?: string;
  /** These listings, for a buyer's list and request. */
  ids?: string[];
};

// ponytail: no pagination; vendors hold 50 to 500 items. Page past this cap if one grows.
const MAX_ROWS = 1000;

function latestPrices(db: Db, storeId: string) {
  return db
    .selectDistinctOn([pricePoint.catalogItemId], {
      catalogItemId: pricePoint.catalogItemId,
      market: pricePoint.marketUsd,
      asOf: pricePoint.date,
    })
    .from(pricePoint)
    .where(
      inArray(
        pricePoint.catalogItemId,
        db
          .select({ id: listing.catalogItemId })
          .from(listing)
          .where(eq(listing.storeId, storeId)),
      ),
    )
    .orderBy(pricePoint.catalogItemId, desc(pricePoint.date))
    .as("latest");
}

function filterConds(storeId: string, f: StockFilter) {
  const name = pick<string>(listing.name, catalogItem.name);
  const conds = [
    eq(listing.storeId, storeId),
    eq(listing.active, f.kind !== "hidden"),
  ];
  if (f.kind && f.kind !== "hidden") conds.push(eq(listing.kind, f.kind));
  if (f.language) conds.push(eq(listing.language, f.language));
  if (f.languages?.length) conds.push(inArray(listing.language, f.languages));
  if (f.id) conds.push(eq(listing.id, f.id));
  if (f.ids) conds.push(inArray(listing.id, f.ids));
  const q = f.q?.trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const number = sql`coalesce(${listing.number}, ${catalogItem.number})`;
    conds.push(or(ilike(name, like), ilike(number, like))!);
  }
  return { name, where: and(...conds) };
}

/** This listing's share of the NM market in percent (src/lib/condition.ts): 100 for NM, sealed and slabs. */
const conditionPct = sql<number>`(case ${listing.condition}
  when 'LP' then ${store.condLpPct}
  when 'MP' then ${store.condMpPct}
  when 'HP' then ${store.condHpPct}
  when 'DMG' then ${store.condDmgPct}
  else 100 end)`.mapWith(Number);

/** A NM market moved to this listing's condition, to the cent. */
const conditionMarket = (nm: unknown) =>
  sql<string | null>`round(${nm} * ${conditionPct} / 100.0, 2)`;

// Custom fields win over the catalog row, so a vendor can relabel an item.
const pick = <T>(own: Column, cat: Column) => sql<T>`coalesce(${own}, ${cat})`;

function columns(latest: ReturnType<typeof latestPrices>) {
  return {
    id: listing.id,
    catalogItemId: listing.catalogItemId,
    setName: pick<string | null>(listing.setName, catalogItem.setName),
    number: pick<string | null>(listing.number, catalogItem.number),
    grader: pick<string | null>(listing.grader, catalogItem.grader),
    grade: pick<string | null>(listing.grade, catalogItem.grade),
    imageUrl: pick<string | null>(listing.imageUrl, catalogItem.imageUrl),
    kind: listing.kind,
    language: listing.language,
    condition: listing.condition,
    qty: listing.qty,
    overridePrice: listing.overridePrice,
    cost: listing.cost,
    active: listing.active,
    createdAt: listing.createdAt,
    // At this listing's condition; nmMarket is the provider's Near Mint price.
    market: conditionMarket(latest.market),
    nmMarket: latest.market,
    conditionPct,
    asOf: latest.asOf,
  };
}

/** The store's stock with display fields resolved and the latest market price. */
export async function listStock(db: Db, storeId: string, f: StockFilter = {}) {
  const latest = latestPrices(db, storeId);
  const { name, where } = filterConds(storeId, f);
  const rows = await db
    .select({ ...columns(latest), name })
    .from(listing)
    .innerJoin(store, eq(store.id, listing.storeId))
    .leftJoin(catalogItem, eq(catalogItem.id, listing.catalogItemId))
    .leftJoin(latest, eq(latest.catalogItemId, listing.catalogItemId))
    .where(where)
    .orderBy(desc(listing.createdAt), desc(listing.id))
    .limit(MAX_ROWS);
  const num = (v: string | null) => (v === null ? null : Number(v));
  return rows.map((r) => ({
    ...r,
    overridePrice: num(r.overridePrice),
    cost: num(r.cost),
    market: num(r.market),
    nmMarket: num(r.nmMarket),
  }));
}

export type StockRow = Awaited<ReturnType<typeof listStock>>[number];

export class ListingError extends Error {}

export const MAX_ACTIVE_LISTINGS = 5000;

// ponytail: count-then-insert can overshoot under concurrent adds; a trigger if that matters.
async function assertRoom(db: Db, storeId: string, adding: number) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(listing)
    .where(and(eq(listing.storeId, storeId), eq(listing.active, true)));
  if (n + adding > MAX_ACTIVE_LISTINGS)
    throw new ListingError(
      `Your shop can list ${MAX_ACTIVE_LISTINGS} items. Hide or remove some first.`,
    );
}

/** A raw card picked with a grader and grade becomes its graded catalog row. */
async function resolveGraded(
  db: Db,
  { grader, grade, ...input }: CatalogListingInput,
) {
  if (!grader || !grade) return input;
  const item = await gradedItem(db, input.catalogItemId, grader, grade);
  if (!item) throw new ListingError("That card is no longer in the catalog");
  return { ...input, catalogItemId: item.id };
}

/** Lists a catalog item; kind and language come from the catalog row, not the client. */
export async function addCatalogListing(
  db: Db,
  storeId: string,
  picked: CatalogListingInput,
) {
  const input = await resolveGraded(db, picked);
  const [item] = await db
    .select({ kind: catalogItem.kind, language: catalogItem.language })
    .from(catalogItem)
    .where(eq(catalogItem.id, input.catalogItemId));
  if (!item) throw new ListingError("That card is no longer in the catalog");
  if (item.kind === "raw" && !input.condition)
    throw new ListingError("Pick a condition");
  await assertRoom(db, storeId, 1);
  const [row] = await db
    .insert(listing)
    .values({
      ...input,
      storeId,
      kind: item.kind,
      language: item.language,
      condition: item.kind === "raw" ? input.condition : null,
    })
    .returning();
  return row;
}

function customValues(storeId: string, input: CustomListingInput) {
  return {
    ...input,
    storeId,
    condition: input.kind === "raw" ? input.condition : null,
    grader: input.kind === "graded" ? input.grader : null,
    grade: input.kind === "graded" ? input.grade : null,
  };
}

export async function addCustomListing(
  db: Db,
  storeId: string,
  input: CustomListingInput & { imageFileId?: string | null },
) {
  await assertRoom(db, storeId, 1);
  const [row] = await db
    .insert(listing)
    .values(customValues(storeId, input))
    .returning();
  return row;
}

export type ImportRow =
  | { kind: "catalog"; input: CatalogListingInput }
  | { kind: "custom"; input: CustomListingInput };

/** The new listings' ids. Inserts every row or none (one INSERT is atomic), so a failed import never leaves half a shelf. */
export async function importListings(
  db: Db,
  storeId: string,
  picked: ImportRow[],
) {
  // ponytail: one upsert per graded row; batch them if slab imports get big.
  const rows = [];
  for (const r of picked)
    rows.push(
      r.kind === "catalog"
        ? { ...r, input: await resolveGraded(db, r.input) }
        : r,
    );
  const ids = rows.flatMap((r) =>
    r.kind === "catalog" ? [r.input.catalogItemId] : [],
  );
  const items = ids.length
    ? await db
        .select({
          id: catalogItem.id,
          kind: catalogItem.kind,
          language: catalogItem.language,
        })
        .from(catalogItem)
        .where(inArray(catalogItem.id, ids))
    : [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const values = rows.map((r) => {
    if (r.kind === "custom") return customValues(storeId, r.input);
    const item = byId.get(r.input.catalogItemId);
    if (!item) throw new ListingError("A matched card left the catalog");
    const condition = item.kind === "raw" ? (r.input.condition ?? "NM") : null;
    const { kind, language } = item;
    return { ...r.input, storeId, kind, language, condition };
  });
  if (!values.length) return [];
  await assertRoom(db, storeId, values.length);
  // 1000 rows x 18 columns stays under the 65535 bind-parameter cap.
  return db
    .insert(listing)
    .values(values)
    .returning({ id: listing.id, catalogItemId: listing.catalogItemId });
}

/** Applies a patch to one of the store's listings; false when it is not theirs. */
export async function updateListing(
  db: Db,
  storeId: string,
  { id, ...patch }: ListingPatch,
) {
  const rows = await db
    .update(listing)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(listing.id, id), eq(listing.storeId, storeId)))
    .returning({ id: listing.id });
  return rows.length > 0;
}

/**
 * Sets or clears (null) a custom listing's photo. Returns the file id it
 * replaced for the caller to drop from storage, or undefined when the listing
 * is not this store's custom item (catalog art isn't the vendor's to change).
 */
export async function setListingPhoto(
  db: Db,
  storeId: string,
  id: string,
  image: { url: string; fileId: string | null } | null,
) {
  return db.transaction(async (tx) => {
    const [old] = await tx
      .select({ fileId: listing.imageFileId })
      .from(listing)
      .where(
        and(
          eq(listing.id, id),
          eq(listing.storeId, storeId),
          isNull(listing.catalogItemId),
        ),
      )
      .for("update");
    if (!old) return undefined;
    await tx
      .update(listing)
      .set({
        imageUrl: image?.url ?? null,
        imageFileId: image?.fileId ?? null,
        updatedAt: sql`now()`,
      })
      .where(eq(listing.id, id));
    return old.fileId;
  });
}

/** Moves qty by delta within 0 to 9999; null when the listing is not theirs. */
export async function stepQty(
  db: Db,
  storeId: string,
  id: string,
  delta: number,
) {
  const rows = await db
    .update(listing)
    .set({
      qty: sql`least(9999, greatest(0, ${listing.qty} + ${delta}))`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(listing.id, id), eq(listing.storeId, storeId)))
    .returning({ qty: listing.qty });
  return rows[0]?.qty ?? null;
}

/** Every listing the store has, hidden ones included; 1 right after the first add. */
export async function countListings(db: Db, storeId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(listing)
    .where(eq(listing.storeId, storeId));
  return n;
}
