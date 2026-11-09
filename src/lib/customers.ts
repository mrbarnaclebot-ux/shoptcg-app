import { and, count, desc, eq, or, sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import { customer } from "@/db/schema";
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

/** Erases a buyer's customer record. Sales keep their snapshot: receipts are financial records. */
export async function removeCustomer(db: Db, storeId: string, id: string) {
  const gone = await db
    .delete(customer)
    .where(and(eq(customer.id, id), eq(customer.storeId, storeId)))
    .returning({ id: customer.id });
  return gone.length > 0;
}

/** "Subscribed since Nov 9", "Unsubscribed Nov 12" or "Receipts only". */
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
    return c.optedInAt ? `Subscribed since ${day(c.optedInAt)}` : "Subscribed";
  return c.optedOutAt ? `Unsubscribed ${day(c.optedOutAt)}` : "Receipts only";
}
