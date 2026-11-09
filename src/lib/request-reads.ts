import { and, desc, eq, inArray, min, sql, sum } from "drizzle-orm";
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
  kind: "raw" | "graded" | "sealed";
  condition: "NM" | "LP" | "MP" | "HP" | "DMG" | null;
};

const ticketCols = {
  id: request.id,
  code: request.code,
  status: effectiveStatus,
  buyerName: request.buyerName,
  isTest: request.isTest,
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
    })
    .from(request)
    .innerJoin(store, eq(store.id, request.storeId))
    .where(and(eq(request.id, id), eq(request.sessionId, sessionId)));
  if (!row) return null;
  const lines = (await linesFor(db, [id])).get(id) ?? [];
  return { ...row, lines };
}

// ponytail: a show day is the server's calendar day; per-store timezones if vendors span zones.
const today = sql`${request.createdAt} >= date_trunc('day', now())`;

/** The seller queue: active requests newest first, then today's lapsed holds. */
export async function storeQueue(db: Db, storeId: string) {
  const rows = await db
    .select({ ...ticketCols, buyerEmail: request.buyerEmail })
    .from(request)
    .where(
      and(
        eq(request.storeId, storeId),
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

export type QueueTicket = Awaited<
  ReturnType<typeof storeQueue>
>["pending"][number];
