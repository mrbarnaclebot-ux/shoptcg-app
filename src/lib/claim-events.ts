import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import {
  claimBlock,
  claimEvent,
  claimEventItem,
  listing,
  request,
  requestLine,
  store,
} from "@/db/schema";
import { listStock } from "@/lib/listings";
import { notifyLive } from "@/lib/live";
import { lockSender } from "@/lib/request-limit";
import { effectiveStatus, heldByListing, linesFor } from "@/lib/request-reads";
import { requestCode, TERMS_VERSION } from "@/lib/requests";
import { ownPhotoUrl, safeImageUrl } from "@/lib/pricing/images";
import { uniqueViolation } from "@/lib/stores";
import { vendorPrice } from "@/lib/vendor-price";

// A timed claim sale at an online store. Each buyer joins once (name, WhatsApp,
// email, a bot check) and gets one request for the event; each claim adds a
// line to it. Claims are requests, so the listing lock, active_hold, confirm,
// receipts and the ledger all work as for a cart.

export type EventStatus = "scheduled" | "live" | "sold_out" | "ended";

export const LIMITS = {
  /** Most joined buyers from one address per event; mobile networks share one. */
  joinsPerIp: 10,
  /** A person taps slower than this; a script doesn't. */
  claimGapMs: 1000,
  maxItems: 200,
  maxDays: 7,
} as const;

/** True while the event hasn't ended: its stock is kept out of the normal store. */
export const eventOpen = sql`(${claimEvent.endedAt} is null and ${claimEvent.endsAt} > now())`;

// Sold out: no event item has a unit that isn't held or sold.
const nothingLeft = sql`not exists (
  select 1 from ${claimEventItem} i join ${listing} l on l.id = i.listing_id
  where i.event_id = ${claimEvent.id} and l.active
    and l.qty > coalesce((select sum(h.qty) from active_hold h where h.listing_id = l.id), 0))`;

/** From the clock, on every read, like storeState: no job flips rows. */
export const eventStatus = sql<EventStatus>`case
  when not ${eventOpen} then 'ended'
  when ${claimEvent.startsAt} > now() then 'scheduled'
  when ${nothingLeft} then 'sold_out'
  else 'live' end`;

const msUntil = (t: unknown) =>
  sql<number>`greatest(0, extract(epoch from ${t} - now()) * 1000)::bigint`.mapWith(
    Number,
  );

/** When this event's claims stop being held: the end plus the pay window. */
const holdUntil = (end: unknown) =>
  sql`${end} + make_interval(hours => ${claimEvent.payWithinHours})`;

const PHONE_DIGITS = /^[0-9]{8,15}$/;

/**
 * A WhatsApp number as digits with the country code, or null. A number typed
 * the local way (leading 0) borrows the country code from the store's own
 * number, assuming the same country and number length.
 */
export function normalizePhone(raw: string, storeWhatsapp: string | null) {
  const t = raw.trim();
  let d = t.replace(/[^0-9]/g, "");
  if (t.startsWith("+")) return PHONE_DIGITS.test(d) ? d : null;
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) {
    // ponytail: same-length guess; a country-code picker if vendors sell abroad.
    const national = d.slice(1);
    if (!storeWhatsapp || storeWhatsapp.length <= national.length) return null;
    d =
      storeWhatsapp.slice(0, storeWhatsapp.length - national.length) + national;
  }
  return PHONE_DIGITS.test(d) ? d : null;
}

export type NewEvent = {
  title: string;
  startsAt: Date;
  endsAt: Date;
  priceMode: "market" | "custom";
  allowUnclaim: boolean;
  payWithinHours: number;
  maxPerBuyer: number;
  items: { listingId: string; price: string | null; maxPerBuyer: number }[];
};

type StoreRow = {
  id: string;
  priceRulePct: number;
  rounding: string;
  sellingMode: string;
  suspendedAt: Date | null;
  whatsapp: string | null;
};

const storeCols = {
  id: store.id,
  priceRulePct: store.priceRulePct,
  rounding: store.rounding,
  sellingMode: store.sellingMode,
  suspendedAt: store.suspendedAt,
  whatsapp: store.whatsapp,
};

/** The price a claim snapshots: the event's own, or the store's normal price now. */
function claimPrice(
  s: StoreRow,
  mode: "market" | "custom",
  itemPrice: string | null,
  row: { market: number | null; overridePrice: number | null },
) {
  if (mode === "custom") return itemPrice === null ? null : Number(itemPrice);
  return vendorPrice(
    row.market,
    s.priceRulePct,
    Number(s.rounding),
    row.overridePrice,
  );
}

/** The store's open (not ended) event, if any: at most one at a time. */
async function openEventId(db: Db, storeId: string) {
  const [row] = await db
    .select({ id: claimEvent.id })
    .from(claimEvent)
    .where(and(eq(claimEvent.storeId, storeId), eventOpen))
    .limit(1);
  return row?.id ?? null;
}

export async function createEvent(
  db: Db,
  storeId: string,
  input: NewEvent,
): Promise<{ ok: true; id: string } | { error: string }> {
  return db.transaction(async (t) => {
    const tx = t as Db;
    // Exclusive: two creates must not both find no open event.
    const [s] = await tx
      .select(storeCols)
      .from(store)
      .where(eq(store.id, storeId))
      .for("no key update");
    if (!s) return { error: "No store." };
    if (s.sellingMode !== "online")
      return { error: "Claim events are for online stores." };
    if (s.suspendedAt) return { error: "Your store is stopped." };
    if (await openEventId(tx, storeId))
      return { error: "End your current event before starting another." };
    const ids = [...new Set(input.items.map((i) => i.listingId))];
    if (!ids.length || ids.length !== input.items.length)
      return { error: "Pick each item once." };
    if (ids.length > LIMITS.maxItems)
      return { error: `An event holds up to ${LIMITS.maxItems} items.` };
    const rows = await listStock(tx, storeId, { ids });
    const by = new Map(rows.map((r) => [r.id, r]));
    for (const i of input.items) {
      const r = by.get(i.listingId);
      if (!r || r.qty < 1)
        return { error: "An item is hidden, out of stock or not yours." };
      if (claimPrice(s, input.priceMode, i.price, r) === null)
        return {
          error:
            input.priceMode === "custom"
              ? `Set a price for ${r.name}.`
              : `${r.name} has no price yet. Use custom prices or set one.`,
        };
    }
    const { items, ...event } = input;
    const [row] = await tx
      .insert(claimEvent)
      .values({ ...event, storeId })
      .returning({ id: claimEvent.id });
    await tx.insert(claimEventItem).values(
      items.map((i) => ({
        eventId: row.id,
        listingId: i.listingId,
        price: input.priceMode === "custom" ? i.price : null,
        maxPerBuyer: i.maxPerBuyer,
      })),
    );
    return { ok: true as const, id: row.id };
  });
}

/** Ends it now; joined buyers keep their claims for the pay window from now. */
export async function endEvent(db: Db, storeId: string, id: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(claimEvent)
      .set({ endedAt: sql`now()` })
      .where(
        and(eq(claimEvent.id, id), eq(claimEvent.storeId, storeId), eventOpen),
      )
      .returning({ hours: claimEvent.payWithinHours });
    if (!row) return false;
    await tx
      .update(request)
      .set({
        expiresAt: sql`now() + make_interval(hours => ${row.hours})`,
      })
      .where(and(eq(request.claimEventId, id), eq(request.status, "pending")));
    await notifyLive(tx as Db, { s: storeId, r: id, t: "claim" });
    return true;
  });
}

export type Buyer = { name: string; phone: string; email: string };

export type JoinResult =
  | { ok: true; id: string }
  | { ended: true }
  | { blocked: true }
  | { limited: true }
  | { taken: "phone" | "email" };

/** The event with its store, as the public page and the actions need it. */
export async function publicEvent(db: Db, id: string, slug?: string) {
  const [row] = await db
    .select({
      id: claimEvent.id,
      title: claimEvent.title,
      status: eventStatus,
      startsAt: claimEvent.startsAt,
      endsAt: claimEvent.endsAt,
      msToStart: msUntil(claimEvent.startsAt),
      msToEnd: msUntil(
        sql`coalesce(${claimEvent.endedAt}, ${claimEvent.endsAt})`,
      ),
      priceMode: claimEvent.priceMode,
      allowUnclaim: claimEvent.allowUnclaim,
      maxPerBuyer: claimEvent.maxPerBuyer,
      payWithinHours: claimEvent.payWithinHours,
      storeId: store.id,
      storeName: store.name,
      slug: store.slug,
      whatsapp: store.whatsapp,
      suspended: sql<boolean>`${store.suspendedAt} is not null`,
    })
    .from(claimEvent)
    .innerJoin(store, eq(store.id, claimEvent.storeId))
    .where(and(eq(claimEvent.id, id), slug ? eq(store.slug, slug) : undefined));
  return row ?? null;
}

export type PublicEvent = NonNullable<Awaited<ReturnType<typeof publicEvent>>>;

/** This phone's joined request for the event, locked for the claim. */
async function joined(tx: Db, eventId: string, sessionId: string) {
  const [row] = await tx
    .select({
      id: request.id,
      phone: request.buyerPhone,
      lastClaimAt: request.lastClaimAt,
      recent: sql<boolean>`${request.lastClaimAt} > now() - make_interval(secs => ${LIMITS.claimGapMs / 1000})`,
    })
    .from(request)
    .where(
      and(
        eq(request.claimEventId, eventId),
        eq(request.sessionId, sessionId),
        eq(request.status, "pending"),
      ),
    )
    .for("update");
  return row ?? null;
}

/**
 * Joins this phone to the event: one pending request with no lines yet.
 * Joining again from the same phone returns the same request. The bot check
 * is the caller's (the action verifies Turnstile first).
 */
export async function joinEvent(
  db: Db,
  e: { id: string; storeId: string },
  k: { sessionId: string; ipHash: string | null },
  buyer: Buyer,
): Promise<JoinResult> {
  try {
    return await db.transaction(async (t) => {
      const tx = t as Db;
      await lockSender(tx, k);
      const [ev] = await tx
        .select({
          status: eventStatus,
          hold: sql<Date>`${holdUntil(claimEvent.endsAt)}`.mapWith(
            (v) => new Date(v),
          ),
          suspended: sql<boolean>`${store.suspendedAt} is not null`,
        })
        .from(claimEvent)
        .innerJoin(store, eq(store.id, claimEvent.storeId))
        .where(eq(claimEvent.id, e.id));
      if (!ev || ev.status === "ended" || ev.suspended) return { ended: true };
      // A buyer the vendor marked paid mid-event has no pending request, so
      // joins again as a new one.
      const mine = await joined(tx, e.id, k.sessionId);
      if (mine) return { ok: true as const, id: mine.id };
      const [block] = await tx
        .select({ id: claimBlock.id })
        .from(claimBlock)
        .where(
          and(
            eq(claimBlock.storeId, e.storeId),
            or(
              eq(claimBlock.phone, buyer.phone),
              eq(claimBlock.email, buyer.email),
            ),
          ),
        )
        .limit(1);
      if (block) return { blocked: true };
      if (k.ipHash) {
        const [{ n }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(request)
          .where(
            and(eq(request.claimEventId, e.id), eq(request.ipHash, k.ipHash)),
          );
        if (n >= LIMITS.joinsPerIp) return { limited: true };
      }
      const [row] = await tx
        .insert(request)
        .values({
          storeId: e.storeId,
          claimEventId: e.id,
          code: requestCode(),
          buyerName: buyer.name,
          buyerEmail: buyer.email,
          buyerPhone: buyer.phone,
          sessionId: k.sessionId,
          ipHash: k.ipHash,
          termsVersion: TERMS_VERSION,
          expiresAt: ev.hold,
        })
        .returning({ id: request.id });
      return { ok: true as const, id: row.id };
    });
  } catch (err) {
    const name = uniqueViolation(err);
    if (name === "request_claim_phone_idx") return { taken: "phone" };
    if (name === "request_claim_email_idx") return { taken: "email" };
    // Two joins from one phone at once: the other one won; read it back.
    if (
      name === "request_claim_session_idx" ||
      name === "request_pending_code_idx"
    )
      return joinEvent(db, e, k, buyer);
    throw err;
  }
}

export type ClaimResult =
  | { ok: true }
  | { notJoined: true }
  | { notLive: true }
  | { taken: true }
  | { limit: "item" | "event" }
  | { slow: true };

/** The units this buyer (by phone) has in the event, per listing and in all. */
async function buyerUnits(tx: Db, eventId: string, phone: string) {
  const rows = await tx
    .select({
      listingId: requestLine.listingId,
      qty: sql<number>`sum(${requestLine.qty})::int`,
    })
    .from(requestLine)
    .innerJoin(request, eq(request.id, requestLine.requestId))
    .where(
      and(
        eq(request.claimEventId, eventId),
        eq(request.buyerPhone, phone),
        sql`${effectiveStatus} in ('pending', 'confirmed')`,
      ),
    )
    .groupBy(requestLine.listingId);
  const by = new Map(rows.map((r) => [r.listingId, r.qty]));
  return { by, total: rows.reduce((n, r) => n + r.qty, 0) };
}

/** One more of this listing for the buyer. The listing lock makes the last unit go once. */
export async function claim(
  db: Db,
  eventId: string,
  sessionId: string,
  listingId: string,
): Promise<ClaimResult> {
  return db.transaction(async (t) => {
    const tx = t as Db;
    const [head] = await tx
      .select({ storeId: claimEvent.storeId })
      .from(claimEvent)
      .where(eq(claimEvent.id, eventId));
    if (!head) return { notLive: true };
    // Lock order everywhere: store, request, listings.
    const [s] = await tx
      .select(storeCols)
      .from(store)
      .where(eq(store.id, head.storeId))
      .for("share");
    const mine = await joined(tx, eventId, sessionId);
    if (!mine?.phone) return { notJoined: true };
    const [ev] = await tx
      .select({
        status: eventStatus,
        priceMode: claimEvent.priceMode,
        maxPerBuyer: claimEvent.maxPerBuyer,
        itemPrice: claimEventItem.price,
        itemMax: claimEventItem.maxPerBuyer,
      })
      .from(claimEvent)
      .innerJoin(
        claimEventItem,
        and(
          eq(claimEventItem.eventId, claimEvent.id),
          eq(claimEventItem.listingId, listingId),
        ),
      )
      .where(eq(claimEvent.id, eventId));
    if (!ev) return { taken: true };
    if (s.suspendedAt || (ev.status !== "live" && ev.status !== "sold_out"))
      return { notLive: true };
    if (mine.recent) return { slow: true };
    await tx
      .select({ id: listing.id })
      .from(listing)
      .where(and(eq(listing.id, listingId), eq(listing.storeId, s.id)))
      .for("update");
    const units = await buyerUnits(tx, eventId, mine.phone);
    if ((units.by.get(listingId) ?? 0) >= ev.itemMax) return { limit: "item" };
    if (units.total >= ev.maxPerBuyer) return { limit: "event" };
    const [[row], held] = await Promise.all([
      listStock(tx, s.id, { ids: [listingId] }),
      heldByListing(tx, s.id, [listingId]),
    ]);
    if (!row || row.qty - (held.get(listingId)?.qty ?? 0) < 1)
      return { taken: true };
    const price = claimPrice(s, ev.priceMode, ev.itemPrice, row);
    if (price === null) return { taken: true };
    const quotedPrice = price.toFixed(2);
    await tx
      .insert(requestLine)
      .values({ requestId: mine.id, listingId, qty: 1, quotedPrice })
      .onConflictDoUpdate({
        target: [requestLine.requestId, requestLine.listingId],
        set: { qty: sql`${requestLine.qty} + 1`, quotedPrice },
      });
    await tx
      .update(request)
      .set({ lastClaimAt: sql`now()` })
      .where(eq(request.id, mine.id));
    await notifyLive(tx, { s: s.id, r: mine.id, t: "claim" });
    return { ok: true as const };
  });
}

/** Gives one unit back, when the event allows it and hasn't ended. */
export async function unclaim(
  db: Db,
  eventId: string,
  sessionId: string,
  listingId: string,
) {
  return db.transaction(async (t) => {
    const tx = t as Db;
    const [ev] = await tx
      .select({
        storeId: claimEvent.storeId,
        status: eventStatus,
        allow: claimEvent.allowUnclaim,
      })
      .from(claimEvent)
      .where(eq(claimEvent.id, eventId));
    if (!ev?.allow || ev.status === "ended" || ev.status === "scheduled")
      return false;
    const mine = await joined(tx, eventId, sessionId);
    if (!mine) return false;
    const line = and(
      eq(requestLine.requestId, mine.id),
      eq(requestLine.listingId, listingId),
    );
    const [left] = await tx
      .update(requestLine)
      .set({ qty: sql`${requestLine.qty} - 1` })
      .where(and(line, sql`${requestLine.qty} > 1`))
      .returning({ qty: requestLine.qty });
    if (!left) {
      const gone = await tx
        .delete(requestLine)
        .where(line)
        .returning({ id: requestLine.listingId });
      if (!gone.length) return false;
    }
    await notifyLive(tx, { s: ev.storeId, r: mine.id, t: "claim" });
    return true;
  });
}

/** The event's items as buyers see them, with what's left and what's this buyer's. */
export async function eventStock(
  db: Db,
  e: PublicEvent,
  sessionId: string | null,
) {
  const s = await db
    .select(storeCols)
    .from(store)
    .where(eq(store.id, e.storeId))
    .then((r) => r[0]);
  const items = await db
    .select({
      listingId: claimEventItem.listingId,
      price: claimEventItem.price,
      maxPerBuyer: claimEventItem.maxPerBuyer,
    })
    .from(claimEventItem)
    .where(eq(claimEventItem.eventId, e.id));
  const ids = items.map((i) => i.listingId);
  const [rows, held, mine] = await Promise.all([
    ids.length ? listStock(db, e.storeId, { ids }) : [],
    heldByListing(db, e.storeId, ids),
    sessionId ? myClaims(db, e.id, sessionId) : null,
  ]);
  const by = new Map(rows.map((r) => [r.id, r]));
  const out = items.flatMap((i) => {
    const r = by.get(i.listingId);
    if (!r) return [];
    return [
      {
        id: r.id,
        catalogItemId: r.catalogItemId,
        name: r.name,
        setName: r.setName,
        number: r.number,
        kind: r.kind,
        language: r.language,
        condition: r.condition,
        grader: r.grader,
        grade: r.grade,
        imageUrl: safeImageUrl(r.imageUrl) ?? ownPhotoUrl(r.imageUrl),
        price: claimPrice(s, e.priceMode, i.price, r),
        qty: r.qty,
        available: Math.max(0, r.qty - (held.get(r.id)?.qty ?? 0)),
        maxPerBuyer: i.maxPerBuyer,
        mine: mine?.lines.find((l) => l.listingId === r.id)?.qty ?? 0,
      },
    ];
  });
  return { items: out, mine };
}

export type EventItem = Awaited<ReturnType<typeof eventStock>>["items"][number];

/** Everything the buyer's event page shows; the page renders it and the poll refreshes it. */
export async function roomState(
  db: Db,
  e: PublicEvent,
  sessionId: string | null,
) {
  const { items, mine } = await eventStock(db, e, sessionId);
  return {
    status: e.suspended ? ("ended" as const) : e.status,
    msToStart: e.msToStart,
    msToEnd: e.msToEnd,
    items,
    mine: mine && {
      code: mine.code,
      status: mine.status,
      name: mine.name,
      phone: mine.phone,
      total: mine.total,
      units: mine.lines.reduce((n, l) => n + l.qty, 0),
    },
  };
}

export type Room = Awaited<ReturnType<typeof roomState>>;

/** This phone's request in the event: pending, or else the latest one. */
export async function myClaims(db: Db, eventId: string, sessionId: string) {
  const [row] = await db
    .select({
      id: request.id,
      code: request.code,
      status: effectiveStatus,
      name: request.buyerName,
      phone: request.buyerPhone,
      email: request.buyerEmail,
    })
    .from(request)
    .where(
      and(eq(request.claimEventId, eventId), eq(request.sessionId, sessionId)),
    )
    .orderBy(sql`${request.status} = 'pending' desc`, desc(request.createdAt))
    .limit(1);
  if (!row) return null;
  const lines = (await linesFor(db, [row.id])).get(row.id) ?? [];
  return {
    ...row,
    lines,
    total: lines.reduce((n, l) => n + l.price * l.qty, 0),
  };
}

/** The store's events, newest first, for the dashboard list. */
export async function listEvents(db: Db, storeId: string) {
  return db
    .select({
      id: claimEvent.id,
      title: claimEvent.title,
      status: eventStatus,
      startsAt: claimEvent.startsAt,
      endsAt:
        sql<Date>`coalesce(${claimEvent.endedAt}, ${claimEvent.endsAt})`.mapWith(
          (v) => new Date(v),
        ),
      items: sql<number>`(select count(*)::int from ${claimEventItem} where ${claimEventItem.eventId} = ${claimEvent.id})`,
      buyers: sql<number>`(select count(*)::int from ${request} where ${request.claimEventId} = ${claimEvent.id}
        and exists (select 1 from ${requestLine} where ${requestLine.requestId} = ${request.id}))`,
    })
    .from(claimEvent)
    .where(eq(claimEvent.storeId, storeId))
    .orderBy(desc(claimEvent.startsAt))
    .limit(50);
}

/** One event for its vendor: settings, items with what's claimed, and every buyer's claims. */
export async function eventForVendor(db: Db, storeId: string, id: string) {
  const [e] = await db
    .select({
      id: claimEvent.id,
      title: claimEvent.title,
      status: eventStatus,
      startsAt: claimEvent.startsAt,
      endsAt:
        sql<Date>`coalesce(${claimEvent.endedAt}, ${claimEvent.endsAt})`.mapWith(
          (v) => new Date(v),
        ),
      msToStart: msUntil(claimEvent.startsAt),
      msToEnd: msUntil(
        sql`coalesce(${claimEvent.endedAt}, ${claimEvent.endsAt})`,
      ),
      priceMode: claimEvent.priceMode,
      allowUnclaim: claimEvent.allowUnclaim,
      maxPerBuyer: claimEvent.maxPerBuyer,
      payWithinHours: claimEvent.payWithinHours,
    })
    .from(claimEvent)
    .where(and(eq(claimEvent.id, id), eq(claimEvent.storeId, storeId)));
  if (!e) return null;
  const buyers = await db
    .select({
      id: request.id,
      code: request.code,
      status: effectiveStatus,
      name: request.buyerName,
      phone: request.buyerPhone,
      email: request.buyerEmail,
      createdAt: request.createdAt,
    })
    .from(request)
    .where(
      and(
        eq(request.claimEventId, id),
        inArray(effectiveStatus, ["pending", "confirmed", "expired"]),
      ),
    )
    .orderBy(request.createdAt);
  const lines = await linesFor(
    db,
    buyers.map((b) => b.id),
  );
  const claims = buyers
    .map((b) => {
      const ls = lines.get(b.id) ?? [];
      return {
        ...b,
        lines: ls,
        items: ls.reduce((n, l) => n + l.qty, 0),
        total: ls.reduce((n, l) => n + l.price * l.qty, 0),
      };
    })
    .filter((b) => b.items > 0);
  const items = await db
    .select({
      listingId: claimEventItem.listingId,
      price: claimEventItem.price,
    })
    .from(claimEventItem)
    .where(eq(claimEventItem.eventId, id));
  const ids = items.map((i) => i.listingId);
  const [rows, held] = await Promise.all([
    ids.length ? listStock(db, storeId, { ids }) : [],
    heldByListing(db, storeId, ids),
  ]);
  return {
    ...e,
    claims,
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      qty: r.qty,
      held: held.get(r.id)?.qty ?? 0,
    })),
  };
}

/** Releases every claim of this buyer (a decline) and stops their phone and email joining again. */
export async function blockBuyer(db: Db, storeId: string, requestId: string) {
  return db.transaction(async (t) => {
    const tx = t as Db;
    const [r] = await tx
      .update(request)
      .set({ status: "declined", decidedAt: sql`now()` })
      .where(
        and(
          eq(request.id, requestId),
          eq(request.storeId, storeId),
          sql`${request.claimEventId} is not null`,
          inArray(effectiveStatus, ["pending", "expired"]),
        ),
      )
      .returning({ phone: request.buyerPhone, email: request.buyerEmail });
    if (!r) return false;
    await tx
      .insert(claimBlock)
      .values({ storeId, phone: r.phone, email: r.email });
    await notifyLive(tx, { s: storeId, r: requestId, t: "declined" });
    return true;
  });
}

/** The scheduled or live event the store page links to, or null. */
export async function storeEvent(db: Db, storeId: string) {
  const [row] = await db
    .select({
      id: claimEvent.id,
      title: claimEvent.title,
      status: eventStatus,
      startsAt: claimEvent.startsAt,
    })
    .from(claimEvent)
    .where(and(eq(claimEvent.storeId, storeId), eventOpen))
    .limit(1);
  return row ?? null;
}

/** Whether this store has this event: the proxy's 404 for the public page. */
export async function eventExists(db: Db, storeId: string, id: string) {
  const [row] = await db
    .select({ id: claimEvent.id })
    .from(claimEvent)
    .where(and(eq(claimEvent.id, id), eq(claimEvent.storeId, storeId)))
    .limit(1);
  return Boolean(row);
}
