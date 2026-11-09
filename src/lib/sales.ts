import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, ne, sql, sum } from "drizzle-orm";
import type { Db } from "@/db/open";
import {
  activeHold,
  customer,
  listing,
  receiptEmail,
  request,
  requestLine,
  sale,
  saleLine,
  store,
  type PaymentMethod,
} from "@/db/schema";
import { gradeLabel } from "@/lib/format";
import { listStock } from "@/lib/listings";
import { notifyLive } from "@/lib/live";
import { fromCents, priceSale, toCents, type Discount } from "@/lib/money";
import { safeImageUrl } from "@/lib/pricing/images";
import { dayStart, effectiveStatus } from "@/lib/request-reads";

export type ConfirmInput = {
  requestId: string;
  lines: { listingId: string; qty: number; unitPrice: string }[];
  discount: Discount;
  method: PaymentMethod;
  note?: string;
  /** The seller's zone, set by the server action; the client can't send it. */
  timeZone?: string;
};

export type ConfirmResult =
  | { ok: true; saleId: string; receiptNo: string; total: string; retry?: true }
  /** These lines can't be covered; nothing changed. */
  | { stock: string[] }
  /** Declined, cancelled, a test, or not this store's; nothing changed. */
  | { gone: true }
  /** Lines or amounts the request can't carry; nothing changed. */
  | { invalid: true };

export const receiptNo = (seq: number) => `R-${String(seq).padStart(4, "0")}`;

/** What each listing can give this request (stock less every other buyer's hold), and whether a hold is in the way. */
export async function coverage(db: Db, requestId: string, ids: string[]) {
  const held = await db
    .select({
      id: activeHold.listingId,
      qty: sum(activeHold.qty).mapWith(Number),
    })
    .from(activeHold)
    .where(
      and(
        inArray(activeHold.listingId, ids),
        ne(activeHold.requestId, requestId),
      ),
    )
    .groupBy(activeHold.listingId);
  const others = new Map(held.map((h) => [h.id, h.qty]));
  const rows = await db
    .select({ id: listing.id, qty: listing.qty })
    .from(listing)
    .where(inArray(listing.id, ids));
  return new Map(
    rows.map((r) => {
      const held = others.get(r.id) ?? 0;
      return [r.id, { left: Math.max(0, r.qty - held), held: held > 0 }];
    }),
  );
}

function upsertCustomer(
  tx: Db,
  c: { storeId: string; email: string; name: string; promo: boolean },
) {
  // A tick (re)subscribes; an untick says nothing, so it keeps what's there.
  const consent = c.promo
    ? { promoOptIn: true, optedInAt: sql`now()`, optedOutAt: null }
    : {};
  return tx
    .insert(customer)
    .values({
      storeId: c.storeId,
      email: c.email,
      name: c.name,
      unsubscribeToken: randomBytes(32).toString("base64url"),
      ...consent,
    })
    .onConflictDoUpdate({
      target: [customer.storeId, customer.email],
      set: {
        name: c.name,
        lastPurchaseAt: sql`now()`,
        purchases: sql`${customer.purchases} + 1`,
        ...consent,
      },
    });
}

type Asked = { listingId: string; qty: number; quotedPrice: string };

function validLines(input: ConfirmInput, asked: Asked[]) {
  const ids = input.lines.map((l) => l.listingId);
  const max = new Map(asked.map((l) => [l.listingId, l.qty]));
  return (
    ids.length > 0 &&
    new Set(ids).size === ids.length &&
    input.lines.every((l) => {
      const most = max.get(l.listingId);
      return (
        most !== undefined &&
        Number.isInteger(l.qty) &&
        l.qty >= 1 &&
        l.qty <= most
      );
    })
  );
}

/** Stock drops, the sale is written, the hold ends and the customer is recorded. */
async function recordSale(
  tx: Db,
  storeId: string,
  s: {
    seq: number;
    name: string;
    secondCurrency: string | null;
    fxRate: string | null;
  },
  r: { promo: boolean; name: string; email: string },
  input: ConfirmInput,
  asked: Asked[],
) {
  const ids = input.lines.map((l) => l.listingId);
  const priced = priceSale(input.lines, input.discount)!;
  // A listing hidden after the request can still be sold at the table.
  const rows = [
    ...(await listStock(tx, storeId, { ids })),
    ...(await listStock(tx, storeId, { ids, kind: "hidden" })),
  ];
  const seq = s.seq + 1;
  const no = receiptNo(seq);
  await tx.update(store).set({ receiptSeq: seq }).where(eq(store.id, storeId));
  const [row] = await tx
    .insert(sale)
    .values({
      storeId,
      requestId: input.requestId,
      seq,
      receiptNo: no,
      storeName: s.name,
      timeZone: input.timeZone,
      buyerName: r.name,
      buyerEmail: r.email,
      subtotal: fromCents(priced.subtotal),
      discount: fromCents(priced.discount),
      discountKind: input.discount.kind === "none" ? null : input.discount.kind,
      discountPct: priced.pct === null ? null : fromCents(priced.pct),
      total: fromCents(priced.total),
      paymentMethod: input.method,
      paymentNote: input.method === "other" ? input.note : null,
      secondCurrency: s.secondCurrency,
      fxRate: s.fxRate,
    })
    .returning({ id: sale.id, total: sale.total });
  await tx.insert(saleLine).values(
    input.lines.map((l, i) => {
      const it = rows.find((x) => x.id === l.listingId)!;
      return {
        saleId: row.id,
        lineNo: i + 1,
        listingId: it.id,
        catalogItemId: it.catalogItemId,
        name: it.name,
        setName: it.setName,
        number: it.number,
        gradeLabel: gradeLabel(it) || null,
        language: it.language,
        // A custom listing can point anywhere; a receipt must not load that host.
        imageUrl: safeImageUrl(it.imageUrl),
        qty: l.qty,
        unitPrice: fromCents(toCents(l.unitPrice)),
        quotedPrice: asked.find((a) => a.listingId === l.listingId)!
          .quotedPrice,
        marketUsd: it.market === null ? null : fromCents(toCents(it.market)),
      };
    }),
  );
  for (const l of input.lines)
    await tx
      .update(listing)
      .set({ qty: sql`${listing.qty} - ${l.qty}`, updatedAt: sql`now()` })
      .where(eq(listing.id, l.listingId));
  // Confirmed releases the holds through the active_hold view.
  await tx
    .update(request)
    .set({ status: "confirmed", decidedAt: sql`now()` })
    .where(eq(request.id, input.requestId));
  await upsertCustomer(tx, {
    storeId,
    email: r.email,
    name: r.name,
    promo: r.promo,
  });
  await tx.insert(receiptEmail).values({ saleId: row.id });
  await notifyLive(tx, { s: storeId, r: input.requestId, t: "confirmed" });
  return { ok: true as const, saleId: row.id, receiptNo: no, total: row.total };
}

async function confirmTx(
  tx: Db,
  storeId: string,
  input: ConfirmInput,
): Promise<ConfirmResult> {
  // Same lock order as a send (store, then listings by id), so they never deadlock.
  const [s] = await tx
    .select({
      seq: store.receiptSeq,
      name: store.name,
      secondCurrency: store.secondCurrency,
      fxRate: store.fxRate,
    })
    .from(store)
    .where(eq(store.id, storeId))
    .for("no key update");
  if (!s) return { gone: true };
  const [r] = await tx
    .select({
      status: effectiveStatus,
      isTest: request.isTest,
      promo: request.promoOptIn,
      name: request.buyerName,
      email: request.buyerEmail,
    })
    .from(request)
    .where(and(eq(request.id, input.requestId), eq(request.storeId, storeId)))
    .for("update");
  if (!r) return { gone: true };
  if (r.status === "confirmed") {
    const [done] = await tx
      .select({ saleId: sale.id, receiptNo: sale.receiptNo, total: sale.total })
      .from(sale)
      .where(eq(sale.requestId, input.requestId));
    return { ok: true, ...done, retry: true };
  }
  const open = r.status === "pending" || r.status === "expired";
  if (!open || r.isTest || !r.name || !r.email) return { gone: true };

  const asked = await tx
    .select({
      listingId: requestLine.listingId,
      qty: requestLine.qty,
      quotedPrice: requestLine.quotedPrice,
    })
    .from(requestLine)
    .where(eq(requestLine.requestId, input.requestId));
  if (!validLines(input, asked) || !priceSale(input.lines, input.discount))
    return { invalid: true };

  const ids = input.lines.map((l) => l.listingId);
  await tx
    .select({ id: listing.id })
    .from(listing)
    .where(inArray(listing.id, ids))
    .orderBy(listing.id)
    .for("update");
  const left = await coverage(tx, input.requestId, ids);
  const short = input.lines
    .filter((l) => l.qty > (left.get(l.listingId)?.left ?? 0))
    .map((l) => l.listingId);
  if (short.length) return { stock: short };
  return recordSale(
    tx,
    storeId,
    s,
    { promo: r.promo, name: r.name, email: r.email },
    input,
    asked,
  );
}

/** All or nothing, and safe to repeat: a second confirm returns the first sale. */
export function confirmSale(db: Db, storeId: string, input: ConfirmInput) {
  return db.transaction((tx) => confirmTx(tx as Db, storeId, input));
}

export const UNSUB_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Opts a buyer out by token. Silent on an unknown token, so it can't be probed. */
export async function optOut(db: Db, token: string) {
  if (!UNSUB_TOKEN.test(token)) return;
  await db
    .update(customer)
    .set({ promoOptIn: false, optedOutAt: sql`now()` })
    .where(
      and(eq(customer.unsubscribeToken, token), eq(customer.promoOptIn, true)),
    );
}

/** What the review screen needs, with live coverage per line; null if not this store's. */
export async function saleDraft(db: Db, storeId: string, requestId: string) {
  const [r] = await db
    .select({
      status: effectiveStatus,
      code: request.code,
      buyerName: request.buyerName,
      isTest: request.isTest,
      expiresAt: request.expiresAt,
      saleId: sale.id,
    })
    .from(request)
    .leftJoin(sale, eq(sale.requestId, request.id))
    .where(and(eq(request.id, requestId), eq(request.storeId, storeId)));
  if (!r) return null;
  const asked = await db
    .select({ id: requestLine.listingId })
    .from(requestLine)
    .where(eq(requestLine.requestId, requestId));
  const left = await coverage(
    db,
    requestId,
    asked.map((l) => l.id),
  );
  return { ...r, left };
}

export const saleLines = (db: Db, id: string) =>
  db
    .select()
    .from(saleLine)
    .where(eq(saleLine.saleId, id))
    .orderBy(saleLine.lineNo);

/** A sale of this store with its lines and email state, or null. */
export async function saleWithLines(db: Db, storeId: string, id: string) {
  const [row] = await db
    .select({
      sale,
      emailStatus: receiptEmail.status,
      emailAttempts: receiptEmail.attempts,
    })
    .from(sale)
    .leftJoin(receiptEmail, eq(receiptEmail.saleId, sale.id))
    .where(and(eq(sale.id, id), eq(sale.storeId, storeId)));
  if (!row) return null;
  return {
    ...row.sale,
    emailStatus: row.emailStatus,
    emailAttempts: row.emailAttempts,
    lines: await saleLines(db, id),
  };
}

/** The sale a buyer's own confirmed request became; the caller checks the cookie. */
export async function saleForRequest(db: Db, requestId: string) {
  const [row] = await db
    .select({ sale, emailStatus: receiptEmail.status })
    .from(sale)
    .leftJoin(receiptEmail, eq(receiptEmail.saleId, sale.id))
    .where(eq(sale.requestId, requestId));
  if (!row) return null;
  return {
    ...row.sale,
    emailStatus: row.emailStatus,
    lines: await saleLines(db, row.sale.id),
  };
}

/** Today's sales, newest first, for the Sales tab and the line under the queue. */
export function salesToday(db: Db, storeId: string, timeZone: string) {
  return db
    .select({
      id: sale.id,
      receiptNo: sale.receiptNo,
      buyerName: sale.buyerName,
      total: sale.total,
      method: sale.paymentMethod,
      createdAt: sale.createdAt,
      timeZone: sale.timeZone,
      items:
        sql<number>`(select coalesce(sum(${saleLine.qty}), 0) from ${saleLine} where ${saleLine.saleId} = ${sale.id})`.mapWith(
          Number,
        ),
    })
    .from(sale)
    .where(
      and(
        eq(sale.storeId, storeId),
        sql`${sale.createdAt} >= ${dayStart(timeZone)}`,
      ),
    )
    .orderBy(desc(sale.createdAt));
}
