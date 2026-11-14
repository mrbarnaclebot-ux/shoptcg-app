import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import { customer, request } from "@/db/schema";
import { appUrl } from "@/lib/deployed";
import { localDate } from "@/lib/reports";

/** Rows drawn on the page; search narrows it, and the promo export has no cap. */
export const CUSTOMERS_SHOWN = 500;

export function listCustomers(
  db: Db,
  storeId: string,
  opts: { subscribed?: boolean; q?: string } = {},
) {
  const like = opts.q && `%${opts.q.replace(/[\\%_]/g, "\\$&")}%`;
  return db
    .select()
    .from(customer)
    .where(
      and(
        eq(customer.storeId, storeId),
        opts.subscribed ? eq(customer.promoOptIn, true) : undefined,
        like
          ? or(
              sql`${customer.name} ilike ${like}`,
              sql`${customer.email} ilike ${like}`,
            )
          : undefined,
      ),
    )
    .orderBy(desc(customer.lastPurchaseAt))
    .limit(CUSTOMERS_SHOWN);
}

export async function subscribedCount(db: Db, storeId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(customer)
    .where(and(eq(customer.storeId, storeId), eq(customer.promoOptIn, true)));
  return n;
}

/** Reads consent at export time: someone who opted out a second ago isn't here. */
export async function promoRows(db: Db, storeId: string, timeZone: string) {
  const rows = await db
    .select()
    .from(customer)
    .where(and(eq(customer.storeId, storeId), eq(customer.promoOptIn, true)))
    .orderBy(customer.email);
  return [
    ["name", "email", "subscribed_at", "unsubscribe_url"],
    ...rows.map((c) => [
      c.name,
      c.email,
      c.optedInAt && localDate(c.optedInAt, timeZone),
      new URL(`/u/${c.unsubscribeToken}`, appUrl()).toString(),
    ]),
  ];
}

/**
 * Erases a buyer's customer record and their details on requests that are over.
 * Sales keep their snapshot: receipts are financial records. Pending and lapsed
 * requests keep theirs, because confirming one reads them; the 30-day purge clears those.
 */
export async function removeCustomer(db: Db, storeId: string, id: string) {
  return db.transaction(async (tx) => {
    const [gone] = await tx
      .delete(customer)
      .where(and(eq(customer.id, id), eq(customer.storeId, storeId)))
      .returning({ email: customer.email });
    if (!gone) return false;
    await tx
      .update(request)
      .set({
        buyerName: null,
        buyerEmail: null,
        ipHash: null,
        buyerPhone: null,
        deliveryAddress: null,
      })
      .where(
        and(
          eq(request.storeId, storeId),
          eq(request.buyerEmail, gone.email),
          inArray(request.status, ["confirmed", "declined", "cancelled"]),
        ),
      );
    return true;
  });
}

/** For the row: enough to recognise a buyer, not enough for a bystander to read off. */
export const maskEmail = (email: string) =>
  `${email[0]}•••${email.slice(email.indexOf("@"))}`;

/** Where consent stands, in words a seller about to email someone can't misread. */
export function promoStatus(
  c: Pick<
    typeof customer.$inferSelect,
    "promoOptIn" | "optedInAt" | "optedOutAt"
  >,
  timeZone: string,
) {
  const day = (at: Date) =>
    at.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone,
    });
  if (c.promoOptIn)
    return {
      state: "subscribed",
      text: c.optedInAt ? `Subscribed since ${day(c.optedInAt)}` : "Subscribed",
    } as const;
  return c.optedOutAt
    ? ({
        state: "unsubscribed",
        text: `Unsubscribed ${day(c.optedOutAt)}. Don't email.`,
      } as const)
    : ({ state: "receipts", text: "Receipts only. No promos." } as const);
}
