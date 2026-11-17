import { and, desc, eq, inArray, isNull, min, sql, sum } from "drizzle-orm";
import type { Db } from "@/db/open";
import {
  activeHold,
  catalogItem,
  listing,
  request,
  requestLine,
  store,
  type RequestStatus,
} from "@/db/schema";
import { safeImageUrl } from "@/lib/pricing/images";

// Expiry is lazy: a pending row past its expires_at reads as expired whether
// or not the sweeper has flipped it yet, so correctness never waits on a timer.
export const effectiveStatus = sql<RequestStatus>`case when ${request.status} = 'pending' and ${request.expiresAt} <= now() then 'expired' else ${request.status} end`;

export type Held = Map<string, { qty: number; endsAt: Date }>;

/** Units held by active requests in this store, by listing, with the soonest release. */
export async function heldByListing(
  db: Db,
  storeId: string,
  ids?: string[],
): Promise<Held> {
  const rows = await db
    .select({
      id: activeHold.listingId,
      qty: sum(activeHold.qty).mapWith(Number),
      endsAt: min(activeHold.expiresAt),
    })
    .from(activeHold)
    .where(
      and(
        eq(activeHold.storeId, storeId),
        ids ? inArray(activeHold.listingId, ids) : undefined,
      ),
    )
    .groupBy(activeHold.listingId);
  return new Map(
    rows.map((r) => [r.id, { qty: r.qty, endsAt: new Date(r.endsAt!) }]),
  );
}

const coalesce = <T>(a: unknown, b: unknown) => sql<T>`coalesce(${a}, ${b})`;

/** Request lines with what the ticket shows, grouped by request id. */
export async function linesFor(db: Db, requestIds: string[]) {
  if (!requestIds.length) return new Map<string, Line[]>();
  const rows = await db
    .select({
      requestId: requestLine.requestId,
      listingId: requestLine.listingId,
      qty: requestLine.qty,
      price: requestLine.quotedPrice,
      name: coalesce<string>(listing.name, catalogItem.name),
      setName: coalesce<string | null>(listing.setName, catalogItem.setName),
      number: coalesce<string | null>(listing.number, catalogItem.number),
      grader: coalesce<string | null>(listing.grader, catalogItem.grader),
      grade: coalesce<string | null>(listing.grade, catalogItem.grade),
      imageUrl: coalesce<string | null>(listing.imageUrl, catalogItem.imageUrl),
      kind: listing.kind,
      condition: listing.condition,
      language: listing.language,
    })
    .from(requestLine)
    .innerJoin(listing, eq(listing.id, requestLine.listingId))
    .leftJoin(catalogItem, eq(catalogItem.id, listing.catalogItemId))
    .where(inArray(requestLine.requestId, requestIds))
    .orderBy(requestLine.listingId);
  const by = new Map<string, Line[]>();
  for (const r of rows) {
    const line = {
      ...r,
      price: Number(r.price),
      imageUrl: safeImageUrl(r.imageUrl),
    };
    by.set(r.requestId, [...(by.get(r.requestId) ?? []), line]);
  }
  return by;
}

export type Line = {
  listingId: string;
  qty: number;
  price: number;
  name: string;
  setName: string | null;
  number: string | null;
  grader: string | null;
  grade: string | null;
  imageUrl: string | null;
  kind: "raw" | "graded" | "sealed" | "other";
  condition: "NM" | "LP" | "MP" | "HP" | "DMG" | null;
  language: "en" | "ja" | "zh";
};

const ticketCols = {
  id: request.id,
  code: request.code,
  status: effectiveStatus,
  buyerName: request.buyerName,
  isTest: request.isTest,
  walkUp: request.walkUp,
  expiresAt: request.expiresAt,
  createdAt: request.createdAt,
};

/** The buyer's own request, or null unless their cookie created it. */
export async function buyerRequest(db: Db, id: string, sessionId: string) {
  const [row] = await db
    .select({
      ...ticketCols,
      storeName: store.name,
      slug: store.slug,
      tableLabel: store.tableLabel,
      sellingMode: store.sellingMode,
      fulfil: request.fulfil,
      payWith: request.payWith,
      deliveryAddress: request.deliveryAddress,
      // Only for a buyer who chose transfer: the page shows it to nobody else.
      bankDetails: sql<
        string | null
      >`case when ${request.payWith} = 'transfer' then ${store.bankDetails} end`,
      whatsapp: sql<
        string | null
      >`case when ${store.sellingMode} = 'online' then ${store.whatsapp} end`,
    })
    .from(request)
    .innerJoin(store, eq(store.id, request.storeId))
    .where(and(eq(request.id, id), eq(request.sessionId, sessionId)));
  if (!row) return null;
  const lines = (await linesFor(db, [id])).get(id) ?? [];
  return { ...row, lines };
}

let zones: Promise<Set<string>> | undefined;

/**
 * This zone if Postgres knows it, else UTC: a browser can name a zone newer than
 * the database's data, and date_trunc errors on those. The view costs ~165 ms, so
 * it's read once a process.
 */
export async function postgresZone(db: Db, zone: string) {
  zones ??= (
    db.execute(sql`select name from pg_timezone_names`) as Promise<unknown>
  ).then((r) => {
    // postgres-js returns the rows, PGlite wraps them.
    const rows = (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows) as {
      name: string;
    }[];
    return new Set(rows.map((row) => row.name));
  });
  try {
    return (await zones).has(zone) ? zone : "UTC";
  } catch (err) {
    zones = undefined;
    throw err;
  }
}

/** Midnight today in this zone: a show day is the seller's, not the database's. */
export const dayStart = (timeZone: string) =>
  sql`date_trunc('day', now(), ${timeZone})`;

/** The seller queue: active requests newest first, then today's lapsed holds. */
export async function storeQueue(db: Db, storeId: string, timeZone: string) {
  const today = sql`${request.createdAt} >= ${dayStart(timeZone)}`;
  const rows = await db
    .select({ ...ticketCols, buyerEmail: request.buyerEmail })
    .from(request)
    .where(
      and(
        eq(request.storeId, storeId),
        // Claims are worked from their event's page.
        isNull(request.claimEventId),
        sql`(${effectiveStatus} = 'pending' or (${effectiveStatus} = 'expired' and ${today}))`,
      ),
    )
    .orderBy(desc(request.createdAt))
    .limit(100);
  const lines = await linesFor(
    db,
    rows.map((r) => r.id),
  );
  const tickets = rows.map((r) => ({ ...r, lines: lines.get(r.id) ?? [] }));
  return {
    pending: tickets.filter((t) => t.status === "pending"),
    expired: tickets.filter((t) => t.status === "expired"),
  };
}

/** Buyers still holding something: what pausing or stopping would leave waiting. */
export async function waitingCount(db: Db, storeId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(request)
    .where(
      and(
        eq(request.storeId, storeId),
        eq(request.isTest, false),
        eq(request.walkUp, false),
        isNull(request.claimEventId),
        sql`${effectiveStatus} = 'pending'`,
      ),
    );
  return row?.n ?? 0;
}

/** This phone's still-held request with exactly these lines: a retry, not a new send. */
export async function pendingDuplicate(
  db: Db,
  k: { sessionId: string; storeId: string },
  wanted: { listingId: string; qty: number }[],
) {
  const rows = await db
    .select({ id: request.id, code: request.code })
    .from(request)
    .where(
      and(
        eq(request.sessionId, k.sessionId),
        eq(request.storeId, k.storeId),
        isNull(request.claimEventId),
        sql`${effectiveStatus} = 'pending'`,
      ),
    );
  const held = await linesFor(
    db,
    rows.map((r) => r.id),
  );
  const key = (ls: { listingId: string; qty: number }[]) =>
    ls
      .map((l) => `${l.listingId}:${l.qty}`)
      .sort()
      .join();
  return rows.find((r) => key(held.get(r.id) ?? []) === key(wanted)) ?? null;
}

export type QueueTicket = Awaited<
  ReturnType<typeof storeQueue>
>["pending"][number];
