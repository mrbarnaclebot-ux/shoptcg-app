import { randomInt } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import { listing, request, requestLine, store } from "@/db/schema";
import { listStock } from "@/lib/listings";
import { notifyLive } from "@/lib/live";
import { lockSender, requestLimited } from "@/lib/request-limit";
import {
  effectiveStatus,
  heldByListing,
  pendingDuplicate,
} from "@/lib/request-reads";
import { HOLD_MS as MODE_HOLD_MS } from "@/lib/selling-mode";
import { storeState } from "@/lib/store-state";
import { uniqueViolation } from "@/lib/stores";
import { vendorPrice } from "@/lib/vendor-price";

/** Bumped when the buyer consent wording or the Terms change. */
export const TERMS_VERSION = "2026-11-12";
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
    listStock(tx, s.id, { ids }),
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

/**
 * One more of this listing on the store's table sale, starting one if none is
 * open. It is a request the vendor makes, so the units are held like any
 * buyer's and it is confirmed on the same screen. Null when none is free.
 */
export function addToTableSale(db: Db, storeId: string, listingId: string) {
  return withCode(db, async (tx) => {
    // Store first and exclusively: two quick taps must not start two sales.
    const [s] = await tx
      .select({
        id: store.id,
        priceRulePct: store.priceRulePct,
        rounding: store.rounding,
      })
      .from(store)
      .where(eq(store.id, storeId))
      .for("no key update");
    if (!s) return null;
    await tx
      .select({ id: listing.id })
      .from(listing)
      .where(and(eq(listing.storeId, storeId), eq(listing.id, listingId)))
      .for("update");
    // Its own hold counts as held, so asking for one asks for one more.
    const { priced } = await quote(tx, s, [{ listingId, qty: 1 }]);
    if (!priced.length) return null;
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
    const { quotedPrice } = priced[0];
    await tx
      .insert(requestLine)
      .values({ requestId: open.id, listingId, qty: 1, quotedPrice })
      .onConflictDoUpdate({
        target: [requestLine.requestId, requestLine.listingId],
        set: { qty: sql`${requestLine.qty} + 1`, quotedPrice },
      });
    return open.id;
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
