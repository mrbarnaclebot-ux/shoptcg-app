import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
  type Column,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@/db/open";
import {
  catalogItem,
  claimEvent,
  claimEventItem,
  listing,
  pricePoint,
  request,
  requestLine,
  stockMove,
  store,
} from "@/db/schema";
import { gradedItem, wordConds } from "@/lib/catalog";
import { CSV_COLUMNS } from "@/lib/csv-import";
import { cartsWith, dropFromCarts } from "@/lib/floor";
import { stockReason } from "@/lib/ledger";
import { notifyLive } from "@/lib/live";
import { effectiveStatus } from "@/lib/request-reads";
import type {
  CatalogListingInput,
  CustomListingInput,
  ListingPatch,
} from "@/lib/listing-input";

// Every function takes the caller's storeId and filters on it: that filter is
// the ownership check, so a listing id from another store matches nothing.

export type StockFilter = {
  q?: string;
  kind?: "raw" | "graded" | "sealed" | "other" | "hidden" | "removed";
  language?: "en" | "ja" | "zh";
  /** Any of these languages (the public page's multi-select chips). */
  languages?: ("en" | "ja" | "zh")[];
  /** One listing, for the public item page. */
  id?: string;
  /** These listings, for a buyer's list and request. */
  ids?: string[];
  /** Leave out listings in a claim event that hasn't ended: they sell there only. */
  forSale?: true;
  /** Newest first unless set. */
  sort?: StockSort;
  /** 1-based, PAGE_ROWS a page. */
  page?: number;
};

export type StockSort = "new" | "name" | "price-desc" | "price-asc" | "qty";

/** In a claim event that hasn't ended (same test as eventOpen in claim-events.ts). */
export const inOpenEvent = sql<boolean>`exists (
  select 1 from ${claimEventItem} join ${claimEvent} on ${claimEvent.id} = ${claimEventItem.eventId}
  where ${claimEventItem.listingId} = ${listing.id}
    and ${claimEvent.endedAt} is null and ${claimEvent.endsAt} > now())`;

// The inventory pages through with `page`; other callers read the first page.
// ponytail: ledger valuation and the buy picker stop at this many rows; page them too if a store passes it.
export const PAGE_ROWS = 1000;

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
  const conds = [eq(listing.storeId, storeId)];
  // Removed stock shows in its own view only; the rest never sees it.
  if (f.kind === "removed") conds.push(isNotNull(listing.removedAt));
  else
    conds.push(
      isNull(listing.removedAt),
      eq(listing.active, f.kind !== "hidden"),
    );
  if (f.kind && f.kind !== "hidden" && f.kind !== "removed")
    conds.push(eq(listing.kind, f.kind));
  if (f.language) conds.push(eq(listing.language, f.language));
  if (f.languages?.length) conds.push(inArray(listing.language, f.languages));
  if (f.id) conds.push(eq(listing.id, f.id));
  if (f.ids) conds.push(inArray(listing.id, f.ids));
  if (f.forSale) conds.push(sql`not ${inOpenEvent}`);
  if (f.q) {
    // Every word, any order, anywhere in the name, set or number.
    const number = pick(listing.number, catalogItem.number);
    const set = pick(listing.setName, catalogItem.setName);
    conds.push(...wordConds(f.q, [name, set, number], number));
  }
  return { name, where: and(...conds) };
}

/**
 * vendorPrice in SQL, so a sort by price holds across pages: the fixed price,
 * else the market moved by the store rule, rounded to the step in whole
 * cents, never under one step.
 */
function priceSql(market: SQL) {
  const step = sql`greatest(round(${store.rounding} * 100), 1)`;
  const cents = sql`round(round(${market} * 100) * (100 + ${store.priceRulePct}) / 100.0)`;
  // greatest() skips nulls, so no market has to be said outright.
  return sql`coalesce(${listing.overridePrice}, case when ${market} is not null
    then greatest(round(${cents} / ${step}) * ${step}, ${step}) / 100.0 end)`;
}

function orderBy(sort: StockSort | undefined, name: SQL, market: SQL) {
  const newest = [desc(listing.createdAt), desc(listing.id)];
  if (sort === "name") return [sql`lower(${name})`, ...newest];
  if (sort === "qty") return [desc(listing.qty), ...newest];
  // Unpriced items go last either way, as on the store page.
  if (sort === "price-desc")
    return [sql`${priceSql(market)} desc nulls last`, ...newest];
  if (sort === "price-asc")
    return [sql`${priceSql(market)} asc nulls last`, ...newest];
  return newest;
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
    removedAt: listing.removedAt,
    inEvent: inOpenEvent,
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
  const cols = columns(latest);
  const rows = await db
    .select({ ...cols, name })
    .from(listing)
    .innerJoin(store, eq(store.id, listing.storeId))
    .leftJoin(catalogItem, eq(catalogItem.id, listing.catalogItemId))
    .leftJoin(latest, eq(latest.catalogItemId, listing.catalogItemId))
    .where(where)
    .orderBy(...orderBy(f.sort, name, cols.market))
    .limit(PAGE_ROWS)
    .offset(((f.page ?? 1) - 1) * PAGE_ROWS);
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

/**
 * Every listing not removed, oldest first, as CSV rows the import reads back:
 * CSV_COLUMNS plus cost, with price only when fixed (else it follows the market).
 */
export async function stockCsvRows(db: Db, storeId: string) {
  const rows = await db
    .select({
      name: pick<string>(listing.name, catalogItem.name),
      set: pick<string | null>(listing.setName, catalogItem.setName),
      number: pick<string | null>(listing.number, catalogItem.number),
      language: listing.language,
      kind: listing.kind,
      condition: listing.condition,
      grader: pick<string | null>(listing.grader, catalogItem.grader),
      grade: pick<string | null>(listing.grade, catalogItem.grade),
      qty: listing.qty,
      price: listing.overridePrice,
      cost: listing.cost,
    })
    .from(listing)
    .leftJoin(catalogItem, eq(catalogItem.id, listing.catalogItemId))
    .where(and(eq(listing.storeId, storeId), isNull(listing.removedAt)))
    .orderBy(listing.createdAt, listing.id);
  const head = [...CSV_COLUMNS, "cost"] as const;
  return [[...head], ...rows.map((r) => head.map((c) => r[c]))];
}

/** Every row listStock pages through for this filter. */
export async function countStock(db: Db, storeId: string, f: StockFilter) {
  const { where } = filterConds(storeId, f);
  const [{ n }] = await db
    .select({ n: count() })
    .from(listing)
    .leftJoin(catalogItem, eq(catalogItem.id, listing.catalogItemId))
    .where(where);
  return n;
}

export class ListingError extends Error {}

export const MAX_ACTIVE_LISTINGS = 5000;

// Hidden and removed items don't count, so hiding or removing makes room.
// ponytail: count-then-insert can overshoot when custom adds race; catalog
// adds, imports and restores lock the store first.
async function assertRoom(db: Db, storeId: string, adding: number) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(listing)
    .where(
      and(
        eq(listing.storeId, storeId),
        eq(listing.active, true),
        isNull(listing.removedAt),
      ),
    );
  if (n + adding > MAX_ACTIVE_LISTINGS)
    throw new ListingError(
      `Your store can show ${MAX_ACTIVE_LISTINGS.toLocaleString("en-US")} items at once. Hide or remove some first.`,
    );
}

/** The store row, locked: sends, sales and buys take it first too, so stock changes queue. */
async function lockStore(tx: Db, storeId: string) {
  const [s] = await tx
    .select({ id: store.id })
    .from(store)
    .where(eq(store.id, storeId))
    .for("no key update");
  return Boolean(s);
}

/**
 * A listing's cost after `qty` more at `cost` each: averaged with the units on
 * hand when their cost is known, else this cost. It reads the old row, so it
 * belongs in the same SET as the qty change.
 */
export const blendCost = (qty: number, cost: string) =>
  sql`case when ${listing.cost} is not null and ${listing.qty} > 0
    then greatest(0.01, round((${listing.qty} * ${listing.cost} + ${qty} * ${cost}::numeric) / (${listing.qty} + ${qty}), 2))
    else ${cost}::numeric end`;

const cardKey = (catalogItemId: string, condition: string | null) =>
  `${catalogItemId}:${condition ?? ""}`;

/**
 * The listing an add of these cards tops up, by card and condition: the oldest
 * one on show. Hidden, removed and claim-event stock get a new row instead.
 */
async function sameCards(tx: Db, storeId: string, catalogItemIds: string[]) {
  const rows = await tx
    .select({
      id: listing.id,
      catalogItemId: listing.catalogItemId,
      condition: listing.condition,
    })
    .from(listing)
    .where(
      and(
        eq(listing.storeId, storeId),
        inArray(listing.catalogItemId, catalogItemIds),
        eq(listing.active, true),
        isNull(listing.removedAt),
        sql`not ${inOpenEvent}`,
      ),
    )
    // Newest first, so the oldest is set last and wins.
    .orderBy(desc(listing.createdAt))
    .for("update");
  return new Map(
    rows.map((r) => [cardKey(r.catalogItemId!, r.condition), r.id]),
  );
}

type Units = { qty: number; cost: string | null; overridePrice: string | null };

/** More of a card the store has: the cost blends in, a fixed price replaces. */
async function topUp(tx: Db, id: string, add: Units) {
  const [row] = await tx
    .update(listing)
    .set({
      qty: sql`${listing.qty} + ${add.qty}`,
      ...(add.cost && { cost: blendCost(add.qty, add.cost) }),
      ...(add.overridePrice && { overridePrice: add.overridePrice }),
      updatedAt: sql`now()`,
    })
    .where(and(eq(listing.id, id), sql`${listing.qty} + ${add.qty} <= 9999`))
    .returning();
  if (!row)
    throw new ListingError(
      "That would put more than 9999 of one card in stock.",
    );
  return row;
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

/**
 * Lists a catalog item; kind and language come from the catalog row, not the
 * client. A card the store already shows in that condition gets the units
 * instead of a second row, and `merged` has its quantity before and after.
 */
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
  const condition = item.kind === "raw" ? input.condition : null;
  return db.transaction(async (t) => {
    const tx = t as Db;
    // Store first: two quick adds of one card make one row, not two.
    await lockStore(tx, storeId);
    await stockReason(tx, "added");
    const same = (await sameCards(tx, storeId, [input.catalogItemId])).get(
      cardKey(input.catalogItemId, condition),
    );
    if (same) {
      const row = await topUp(tx, same, input);
      return { ...row, merged: { from: row.qty - input.qty, to: row.qty } };
    }
    await assertRoom(tx, storeId, 1);
    const [row] = await tx
      .insert(listing)
      .values({
        ...input,
        storeId,
        kind: item.kind,
        language: item.language,
        condition,
      })
      .returning();
    return { ...row, merged: null };
  });
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

/**
 * The listings the rows went to. All rows or none, so a failed import never
 * leaves half a shelf. Catalog rows follow the add rule: a card the store
 * shows in that condition, or a second row of one card, tops up one listing.
 * Custom rows are always new.
 */
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
    if (r.kind === "custom")
      return { key: null, value: customValues(storeId, r.input) };
    const item = byId.get(r.input.catalogItemId);
    if (!item) throw new ListingError("A matched card left the catalog");
    const condition = item.kind === "raw" ? (r.input.condition ?? "NM") : null;
    const { kind, language } = item;
    return {
      key: cardKey(r.input.catalogItemId, condition),
      value: { ...r.input, storeId, kind, language, condition },
    };
  });
  if (!values.length) return [];
  return db.transaction(async (t) => {
    const tx = t as Db;
    await lockStore(tx, storeId);
    await stockReason(tx, "added");
    const target = ids.length
      ? await sameCards(tx, storeId, ids)
      : new Map<string, string>();
    const fresh = [];
    const later = [];
    for (const v of values) {
      if (v.key && target.has(v.key)) later.push(v);
      else {
        // Claimed now; the new row's id lands after the insert.
        if (v.key) target.set(v.key, "");
        fresh.push(v);
      }
    }
    await assertRoom(tx, storeId, fresh.length);
    // 1000 rows x 18 columns stays under the 65535 bind-parameter cap.
    const added = fresh.length
      ? await tx
          .insert(listing)
          .values(fresh.map((v) => v.value))
          .returning({
            id: listing.id,
            catalogItemId: listing.catalogItemId,
            condition: listing.condition,
          })
      : [];
    const out = added.map((r) => {
      if (r.catalogItemId)
        target.set(cardKey(r.catalogItemId, r.condition), r.id);
      return { id: r.id, catalogItemId: r.catalogItemId };
    });
    // ponytail: one UPDATE per topped-up row; batch them if whole-shelf re-imports get slow.
    for (const v of later) {
      const row = await topUp(tx, target.get(v.key!)!, v.value);
      out.push({ id: row.id, catalogItemId: row.catalogItemId });
    }
    return out;
  });
}

/**
 * Applies a patch to one of the store's listings; false when it is not theirs
 * or removed. Name, set and number are a custom item's own: catalog cards
 * take theirs from the catalog.
 */
export async function updateListing(
  db: Db,
  storeId: string,
  { id, ...patch }: ListingPatch,
) {
  const own = [patch.name, patch.setName, patch.number].some(
    (v) => v !== undefined,
  );
  const rows = await db
    .update(listing)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(
      and(
        eq(listing.id, id),
        eq(listing.storeId, storeId),
        isNull(listing.removedAt),
        own ? isNull(listing.catalogItemId) : undefined,
      ),
    )
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

/** Moves qty by delta within 0 to 9999; null when the listing is not theirs or removed. */
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
    .where(
      and(
        eq(listing.id, id),
        eq(listing.storeId, storeId),
        isNull(listing.removedAt),
      ),
    )
    .returning({ qty: listing.qty });
  return rows[0]?.qty ?? null;
}

export type RemoveResult =
  | { ok: true; names: string[] }
  /** Buyers hold them on this many requests and carts; nothing changed yet. */
  | { held: number }
  /** One is in a claim event that hasn't ended: its claims would vanish. */
  | { event: string }
  /** None is this store's, or all are removed already. */
  | { gone: true };

/**
 * Takes listings out of the inventory, the store and every unsent cart, with
 * their quantity to 0 as a "removed" stock move; restoreListings undoes it.
 * Each buyer holding one loses that line and is told, and a request left with
 * nothing is declined. Without `force` it stops at { held } so the vendor can
 * be asked first. One in a live or scheduled claim event stops the lot.
 */
export async function removeListings(
  db: Db,
  storeId: string,
  ids: string[],
  force: boolean,
): Promise<RemoveResult> {
  return db.transaction(async (t) => {
    const tx = t as Db;
    // Store first, like a send or a sale, so none lands halfway through.
    if (!ids.length || !(await lockStore(tx, storeId))) return { gone: true };
    const rows = await tx
      .select({
        id: listing.id,
        name: pick<string>(listing.name, catalogItem.name),
      })
      .from(listing)
      .leftJoin(catalogItem, eq(catalogItem.id, listing.catalogItemId))
      .where(
        and(
          inArray(listing.id, ids),
          eq(listing.storeId, storeId),
          isNull(listing.removedAt),
        ),
      )
      .orderBy(listing.id)
      .for("update", { of: listing });
    if (!rows.length) return { gone: true };
    const found = rows.map((r) => r.id);
    const [event] = await tx
      .select({ title: claimEvent.title })
      .from(claimEventItem)
      .innerJoin(claimEvent, eq(claimEvent.id, claimEventItem.eventId))
      .where(
        and(
          inArray(claimEventItem.listingId, found),
          isNull(claimEvent.endedAt),
          sql`${claimEvent.endsAt} > now()`,
        ),
      )
      .limit(1);
    if (event) return { event: event.title };
    const holding = await tx
      .select({ id: request.id, listingId: requestLine.listingId })
      .from(request)
      .innerJoin(requestLine, eq(requestLine.requestId, request.id))
      .where(
        and(
          eq(request.storeId, storeId),
          inArray(requestLine.listingId, found),
          sql`${effectiveStatus} = 'pending'`,
        ),
      );
    const name = new Map(rows.map((r) => [r.id, r.name]));
    const gone = new Map<string, string[]>();
    for (const h of holding)
      gone.set(h.id, [...(gone.get(h.id) ?? []), name.get(h.listingId)!]);
    const held = gone.size + (await cartsWith(tx, storeId, found));
    if (!force && held) return { held };

    await stockReason(tx, "removed");
    await tx
      .update(listing)
      .set({ removedAt: sql`now()`, qty: 0, updatedAt: sql`now()` })
      .where(inArray(listing.id, found));
    const asked = [...gone.keys()];
    if (asked.length) {
      await tx
        .delete(requestLine)
        .where(
          and(
            inArray(requestLine.listingId, found),
            inArray(requestLine.requestId, asked),
          ),
        );
      for (const [id, names] of gone)
        await tx
          .update(request)
          .set({
            removedItems: sql`${request.removedItems} || array[${sql.join(
              names.map((n) => sql`${n}`),
              sql`, `,
            )}]::text[]`,
          })
          .where(eq(request.id, id));
      // Nothing left to sell: closed the way a seller's decline closes it.
      const closed = await tx
        .update(request)
        .set({ status: "declined", decidedAt: sql`now()` })
        .where(
          and(
            inArray(request.id, asked),
            sql`not exists (select 1 from ${requestLine} where ${requestLine.requestId} = ${request.id})`,
          ),
        )
        .returning({ id: request.id });
      const done = new Set(closed.map((c) => c.id));
      for (const r of asked)
        await notifyLive(tx, {
          s: storeId,
          r,
          t: done.has(r) ? "declined" : "removed",
        });
    }
    if (await dropFromCarts(tx, storeId, found))
      await notifyLive(tx, { s: storeId, r: "", t: "floor" });
    return { ok: true, names: rows.map((r) => r.name) };
  });
}

/**
 * Brings removed listings back with the quantity each had, as "restored"
 * moves. Returns how many came back: 0 when none is this store's and removed.
 */
export async function restoreListings(db: Db, storeId: string, ids: string[]) {
  return db.transaction(async (t) => {
    const tx = t as Db;
    if (!ids.length || !(await lockStore(tx, storeId))) return 0;
    const rows = await tx
      .select({ active: listing.active })
      .from(listing)
      .where(
        and(
          inArray(listing.id, ids),
          eq(listing.storeId, storeId),
          isNotNull(listing.removedAt),
        ),
      )
      .orderBy(listing.id)
      .for("update");
    if (!rows.length) return 0;
    await assertRoom(tx, storeId, rows.filter((r) => r.active).length);
    await stockReason(tx, "restored");
    // This removal's own move: an older one may predate a sale since.
    const had = sql`(select -${stockMove.delta} from ${stockMove}
      where ${stockMove.listingId} = ${listing.id} and ${stockMove.reason} = 'removed'
        and ${stockMove.at} >= ${listing.removedAt}
      order by ${stockMove.at} desc limit 1)`;
    const back = await tx
      .update(listing)
      .set({
        qty: sql`least(9999, ${listing.qty} + coalesce(${had}, 0))`,
        removedAt: null,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          inArray(listing.id, ids),
          eq(listing.storeId, storeId),
          isNotNull(listing.removedAt),
        ),
      )
      .returning({ id: listing.id });
    return back.length;
  });
}

/**
 * Hides or shows these listings (not removed ones). Showing checks the room
 * on the store first. Returns how many changed.
 */
export async function setActive(
  db: Db,
  storeId: string,
  ids: string[],
  active: boolean,
) {
  return db.transaction(async (t) => {
    const tx = t as Db;
    if (!ids.length || !(await lockStore(tx, storeId))) return 0;
    const mine = and(
      inArray(listing.id, ids),
      eq(listing.storeId, storeId),
      isNull(listing.removedAt),
      eq(listing.active, !active),
    );
    if (active) {
      const [{ n }] = await tx.select({ n: count() }).from(listing).where(mine);
      await assertRoom(tx, storeId, n);
    }
    const rows = await tx
      .update(listing)
      .set({ active, updatedAt: sql`now()` })
      .where(mine)
      .returning({ id: listing.id });
    return rows.length;
  });
}

/** Every listing the store has, hidden ones included; 1 right after the first add. */
export async function countListings(db: Db, storeId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(listing)
    .where(eq(listing.storeId, storeId));
  return n;
}
