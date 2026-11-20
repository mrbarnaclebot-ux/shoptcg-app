import { randomInt } from "node:crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import type { Checkout } from "@/lib/checkout";
import { listing, request, requestLine, store } from "@/db/schema";
import { listStock } from "@/lib/listings";
import { notifyLive } from "@/lib/live";
import { lockSender, requestLimited } from "@/lib/request-limit";
import {
  effectiveStatus,
  heldByListing,
  pendingDuplicate,
} from "@/lib/request-reads";
import {
  EXTEND_MIN,
  HOLD_MS as MODE_HOLD_MS,
  MAX_EXTEND_MIN,
} from "@/lib/selling-mode";
import { storeState } from "@/lib/store-state";
import { uniqueViolation } from "@/lib/stores";
import { stockMeta, usd } from "@/lib/format";
import { vendorPrice } from "@/lib/vendor-price";

/** Bumped when the buyer consent wording or the Terms change; /terms shows it as the date. */
export const TERMS_VERSION = "2026-11-19";
/** A table hold: the vendor's own table sale and test requests use it. */
export const HOLD_MS = MODE_HOLD_MS.table;
export const MAX_LINES = 30;

// No 0/O, 1/I/L or U: the code is read aloud across a table.
const CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export function requestCode() {
  return Array.from(
    { length: 4 },
    () => CODE_CHARS[randomInt(CODE_CHARS.length)],
  ).join("");
}

export type LineInput = { listingId: string; qty: number };

export type NewRequest = {
  storeId: string;
  lines: LineInput[];
  buyerName: string;
  buyerEmail: string | null;
  promo: boolean;
  sessionId: string;
  ipHash: string | null;
  holdMs: number;
  isTest?: boolean;
  checkout?: Checkout;
};

export type CreateResult =
  | {
      ok: true;
      id: string;
      code: string;
      items: number;
      total: number;
      retry?: true;
    }
  | { ok: false; taken: string[] }
  | { ok: false; closed: true }
  | { ok: false; limited: true };

type StoreRow = { id: string; priceRulePct: number; rounding: string };

/** Prices every line server side and reports lines that cannot be held. */
async function quote(tx: Db, s: StoreRow, lines: LineInput[]) {
  const ids = lines.map((l) => l.listingId);
  const [rows, held] = await Promise.all([
    listStock(tx, s.id, { ids, forSale: true }),
    heldByListing(tx, s.id, ids),
  ]);
  const by = new Map(rows.map((r) => [r.id, r]));
  const taken: string[] = [];
  const priced = [];
  for (const l of lines) {
    const r = by.get(l.listingId);
    const price =
      r &&
      vendorPrice(
        r.market,
        s.priceRulePct,
        Number(s.rounding),
        r.overridePrice,
      );
    const left = r ? r.qty - (held.get(r.id)?.qty ?? 0) : 0;
    // ponytail: an unpriced line counts as taken; buyers can't add those from the page anyway.
    if (price == null || l.qty > left) taken.push(l.listingId);
    else priced.push({ ...l, quotedPrice: price.toFixed(2), price });
  }
  return { taken, priced };
}

async function insertRequest(tx: Db, input: NewRequest): Promise<CreateResult> {
  if (!input.isTest) {
    await lockSender(tx, input);
    // A lost response must not leave the buyer blocked by their own hold.
    const dup = await pendingDuplicate(tx, input, input.lines);
    if (dup) return { ok: true, ...dup, items: 0, total: 0, retry: true };
    if (await requestLimited(tx, input)) return { ok: false, limited: true };
  }
  // Lock order is always store, then listings by id, so two sends never deadlock.
  const [s] = await tx
    .select({
      id: store.id,
      state: storeState,
      priceRulePct: store.priceRulePct,
      rounding: store.rounding,
    })
    .from(store)
    .where(eq(store.id, input.storeId))
    .for("share");
  if (!s || (s.state !== "open" && !input.isTest))
    return { ok: false, closed: true };
  const ids = input.lines.map((l) => l.listingId);
  await tx
    .select({ id: listing.id })
    .from(listing)
    .where(and(eq(listing.storeId, s.id), inArray(listing.id, ids)))
    .orderBy(listing.id)
    .for("update");
  const { taken, priced } = await quote(tx, s, input.lines);
  if (taken.length) return { ok: false, taken };
  const [row] = await tx
    .insert(request)
    .values({
      storeId: s.id,
      code: requestCode(),
      buyerName: input.buyerName,
      buyerEmail: input.buyerEmail,
      sessionId: input.sessionId,
      ipHash: input.ipHash,
      isTest: input.isTest ?? false,
      promoOptIn: input.promo,
      ...input.checkout,
      termsVersion: TERMS_VERSION,
      expiresAt: sql`now() + make_interval(secs => ${input.holdMs / 1000})`,
    })
    .returning({ id: request.id, code: request.code });
  await tx
    .insert(requestLine)
    .values(priced.map((l) => ({ requestId: row.id, ...l })));
  await notifyLive(tx, { s: s.id, r: row.id, t: "new" });
  return {
    ok: true,
    ...row,
    items: priced.reduce((n, l) => n + l.qty, 0),
    total: priced.reduce((n, l) => n + l.price * l.qty, 0),
  };
}

/** One transaction per attempt; a code collision with another pending request retries. */
async function withCode<T>(db: Db, run: (tx: Db) => Promise<T>) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.transaction((tx) => run(tx as Db));
    } catch (err) {
      const collided = uniqueViolation(err) === "request_pending_code_idx";
      if (!collided || attempt >= 5) throw err;
    }
  }
}

export function createRequest(db: Db, input: NewRequest) {
  return withCode<CreateResult>(db, (tx) => insertRequest(tx, input));
}

const WALK_UP = "Walk-up";

const openTableSale = (storeId: string) =>
  and(
    eq(request.storeId, storeId),
    eq(request.walkUp, true),
    sql`${effectiveStatus} = 'pending'`,
  );

/** The sale the vendor is building for a buyer at the table, or null. */
export async function tableSale(db: Db, storeId: string) {
  const [row] = await db
    .select({
      id: request.id,
      items: sql<number>`coalesce(sum(${requestLine.qty}), 0)::int`,
      total:
        sql<string>`coalesce(sum(${requestLine.qty} * ${requestLine.quotedPrice}), 0)`.mapWith(
          Number,
        ),
    })
    .from(request)
    .leftJoin(requestLine, eq(requestLine.requestId, request.id))
    .where(openTableSale(storeId))
    .groupBy(request.id)
    .orderBy(desc(request.createdAt))
    .limit(1);
  return row ?? null;
}

// Store first and exclusively: two quick taps must not start two sales, and
// an add can't land in the middle of a confirm.
const lockStoreForAdd = async (tx: Db, storeId: string) =>
  (
    await tx
      .select({
        id: store.id,
        priceRulePct: store.priceRulePct,
        rounding: store.rounding,
      })
      .from(store)
      .where(eq(store.id, storeId))
      .for("no key update")
  ).at(0);

/** Locks a listing and prices one more unit of it; null when none is free. */
async function oneMore(tx: Db, s: StoreRow, listingId: string) {
  await tx
    .select({ id: listing.id })
    .from(listing)
    .where(and(eq(listing.storeId, s.id), eq(listing.id, listingId)))
    .for("update");
  // Its own hold counts as held, so asking for one asks for one more.
  const { priced } = await quote(tx, s, [{ listingId, qty: 1 }]);
  return priced[0]?.quotedPrice ?? null;
}

/** One more unit on the request's line for the listing, or a new line. */
const holdLine = (
  tx: Db,
  requestId: string,
  listingId: string,
  quotedPrice: string,
) =>
  tx
    .insert(requestLine)
    .values({ requestId, listingId, qty: 1, quotedPrice })
    .onConflictDoUpdate({
      target: [requestLine.requestId, requestLine.listingId],
      set: { qty: sql`${requestLine.qty} + 1`, quotedPrice },
    });

/**
 * One more of this listing on the store's table sale, starting one if none is
 * open. It is a request the vendor makes, so the units are held like any
 * buyer's and it is confirmed on the same screen. Null when none is free.
 */
export function addToTableSale(db: Db, storeId: string, listingId: string) {
  return withCode(db, async (tx) => {
    const s = await lockStoreForAdd(tx, storeId);
    if (!s) return null;
    const quotedPrice = await oneMore(tx, s, listingId);
    if (quotedPrice === null) return null;
    const expiresAt = sql`now() + make_interval(secs => ${HOLD_MS / 1000})`;
    let [open] = await tx
      .update(request)
      .set({ expiresAt })
      .where(openTableSale(storeId))
      .returning({ id: request.id });
    open ??= (
      await tx
        .insert(request)
        .values({
          storeId,
          code: requestCode(),
          buyerName: WALK_UP,
          sessionId: `table:${storeId}`,
          walkUp: true,
          termsVersion: TERMS_VERSION,
          expiresAt,
        })
        .returning({ id: request.id })
    )[0];
    await holdLine(tx, open.id, listingId, quotedPrice);
    return open.id;
  });
}

/**
 * One more of a listing on an open sale: a card the buyer picked up at the
 * table, or one more of a line. Held like the rest, so it can't be sold
 * twice. Not on a test or a claim (paid at a distance). False when none is
 * free or the request is no longer pending.
 */
export function addToRequest(
  db: Db,
  storeId: string,
  requestId: string,
  listingId: string,
) {
  return db.transaction(async (t) => {
    const tx = t as Db;
    const s = await lockStoreForAdd(tx, storeId);
    if (!s) return false;
    const [r] = await tx
      .select({ id: request.id })
      .from(request)
      .where(
        and(
          eq(request.id, requestId),
          eq(request.storeId, storeId),
          eq(request.isTest, false),
          isNull(request.claimEventId),
          sql`${effectiveStatus} = 'pending'`,
        ),
      )
      .for("update");
    if (!r) return false;
    // The confirm takes at most MAX_LINES lines.
    const lines = await tx
      .select({ id: requestLine.listingId })
      .from(requestLine)
      .where(eq(requestLine.requestId, requestId));
    if (lines.length >= MAX_LINES && !lines.some((l) => l.id === listingId))
      return false;
    const quotedPrice = await oneMore(tx, s, listingId);
    if (quotedPrice === null) return false;
    await holdLine(tx, requestId, listingId, quotedPrice);
    await notifyLive(tx, { s: storeId, r: requestId, t: "added" });
    return true;
  });
}

/** A few in-stock, for-sale listings matching the words, with how many are free and their price. */
export async function findFreeStock(db: Db, storeId: string, q: string) {
  const [s] = await db
    .select({ priceRulePct: store.priceRulePct, rounding: store.rounding })
    .from(store)
    .where(eq(store.id, storeId));
  const rows = await listStock(db, storeId, {
    q,
    forSale: true,
    inStock: true,
    limit: 12,
  });
  const held = await heldByListing(
    db,
    storeId,
    rows.map((r) => r.id),
  );
  return rows
    .map((r) => ({
      r,
      free: r.qty - (held.get(r.id)?.qty ?? 0),
      price: vendorPrice(
        r.market,
        s.priceRulePct,
        Number(s.rounding),
        r.overridePrice,
      ),
    }))
    .filter((x) => x.free > 0 && x.price !== null)
    .slice(0, 6)
    .map(({ r, free, price }) => ({
      id: r.id,
      name: r.name,
      meta: stockMeta(r),
      note: `${free} free · ${usd(price!)}`,
    }));
}

/**
 * Pushes a buyer's hold back EXTEND_MIN minutes, up to MAX_EXTEND_MIN in all.
 * Only a pending buyer request: a table sale renews on each tap and a claim
 * holds until its pay window. The new end, or null when it can't move.
 */
export function extendHold(db: Db, storeId: string, id: string) {
  return db.transaction(async (t) => {
    const tx = t as Db;
    const [row] = await tx
      .update(request)
      .set({
        expiresAt: sql`${request.expiresAt} + make_interval(mins => ${EXTEND_MIN})`,
        holdAddedMin: sql`${request.holdAddedMin} + ${EXTEND_MIN}`,
      })
      .where(
        and(
          eq(request.id, id),
          eq(request.storeId, storeId),
          eq(request.walkUp, false),
          isNull(request.claimEventId),
          sql`${effectiveStatus} = 'pending'`,
          sql`${request.holdAddedMin} + ${EXTEND_MIN} <= ${MAX_EXTEND_MIN}`,
        ),
      )
      .returning({ expiresAt: request.expiresAt });
    if (row) await notifyLive(tx, { s: storeId, r: id, t: "extended" });
    return row?.expiresAt ?? null;
  });
}

type Change = {
  id: string;
  to: "declined" | "cancelled";
  where: ReturnType<typeof and>;
  from: ("pending" | "expired")[];
};

async function settle(db: Db, c: Change) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(request)
      .set({ status: c.to, decidedAt: sql`now()` })
      .where(
        and(eq(request.id, c.id), c.where, inArray(effectiveStatus, c.from)),
      )
      .returning({ storeId: request.storeId });
    if (row) await notifyLive(tx as Db, { s: row.storeId, r: c.id, t: c.to });
    return Boolean(row);
  });
}

/** Seller declines: the hold ends at once. False when not theirs or already settled. */
export function declineRequest(db: Db, storeId: string, id: string) {
  return settle(db, {
    id,
    to: "declined",
    where: eq(request.storeId, storeId),
    from: ["pending", "expired"],
  });
}

/** Buyer cancels their own still-held request. */
export function cancelRequest(db: Db, sessionId: string, id: string) {
  return settle(db, {
    id,
    to: "cancelled",
    where: eq(request.sessionId, sessionId),
    from: ["pending"],
  });
}

export { shortName } from "@/lib/short-name";
