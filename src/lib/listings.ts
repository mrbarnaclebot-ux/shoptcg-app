import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type Column,
} from "drizzle-orm";
import type { Db } from "@/db/open";
import { catalogItem, listing, pricePoint } from "@/db/schema";
import type {
  CatalogListingInput,
  CustomListingInput,
  ListingPatch,
} from "@/lib/listing-input";

// Every function takes the caller's storeId and filters on it: that filter is
// the ownership check, so a listing id from another store matches nothing.

export type StockFilter = {
  q?: string;
  kind?: "raw" | "graded" | "sealed" | "hidden";
  language?: "en" | "ja" | "zh";
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
  const q = f.q?.trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const number = sql`coalesce(${listing.number}, ${catalogItem.number})`;
    conds.push(or(ilike(name, like), ilike(number, like))!);
  }
  return { name, where: and(...conds) };
}

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
    active: listing.active,
    market: latest.market,
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
    .leftJoin(catalogItem, eq(catalogItem.id, listing.catalogItemId))
    .leftJoin(latest, eq(latest.catalogItemId, listing.catalogItemId))
    .where(where)
    .orderBy(desc(listing.createdAt), desc(listing.id))
    .limit(MAX_ROWS);
  const num = (v: string | null) => (v === null ? null : Number(v));
  return rows.map((r) => ({
    ...r,
    overridePrice: num(r.overridePrice),
    market: num(r.market),
  }));
}

export type StockRow = Awaited<ReturnType<typeof listStock>>[number];

export class ListingError extends Error {}

/** Lists a catalog item; kind and language come from the catalog row, not the client. */
export async function addCatalogListing(
  db: Db,
  storeId: string,
  input: CatalogListingInput,
) {
  const [item] = await db
    .select({ kind: catalogItem.kind, language: catalogItem.language })
    .from(catalogItem)
    .where(eq(catalogItem.id, input.catalogItemId));
  if (!item) throw new ListingError("That card is no longer in the catalog");
  if (item.kind === "raw" && !input.condition)
    throw new ListingError("Pick a condition");
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
  input: CustomListingInput,
) {
  const [row] = await db
    .insert(listing)
    .values(customValues(storeId, input))
    .returning();
  return row;
}

export type ImportRow =
  | { kind: "catalog"; input: CatalogListingInput }
  | { kind: "custom"; input: CustomListingInput };

/** Inserts every row or none (one INSERT is atomic), so a failed import never leaves half a shelf. */
export async function importListings(
  db: Db,
  storeId: string,
  rows: ImportRow[],
) {
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
  if (!values.length) return 0;
  // 1000 rows x 18 columns stays under the 65535 bind-parameter cap.
  const inserted = await db
    .insert(listing)
    .values(values)
    .returning({ id: listing.id });
  return inserted.length;
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

/** Moves qty by delta, never below 0; false when the listing is not theirs. */
export async function stepQty(
  db: Db,
  storeId: string,
  id: string,
  delta: number,
) {
  const rows = await db
    .update(listing)
    .set({
      qty: sql`greatest(0, ${listing.qty} + ${delta})`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(listing.id, id), eq(listing.storeId, storeId)))
    .returning({ qty: listing.qty });
  return rows[0]?.qty ?? null;
}
