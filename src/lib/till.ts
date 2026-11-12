import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/open";
import { buy, sale, till } from "@/db/schema";
import { fromCents, toCents } from "@/lib/money";
import { voided } from "@/lib/reports";

/** Cash in the box: zero or more, to the cent. */
export const cashSchema = z
  .string()
  .trim()
  .regex(/^\$?\d{1,7}(\.\d{1,2})?$/, "Enter an amount like 150 or 82.50")
  .transform((v) => Number(v.replace("$", "")).toFixed(2));

/** Starts a cash box unless one is already open; a till outlives pauses. */
export async function openTill(db: Db, storeId: string) {
  await db.insert(till).values({ storeId }).onConflictDoNothing();
}

/** Sets the open box's float, opening one if needed. Null clears it. */
export async function setFloat(db: Db, storeId: string, amount: string | null) {
  await openTill(db, storeId);
  await db
    .update(till)
    .set({ openingFloat: amount })
    .where(and(eq(till.storeId, storeId), isNull(till.closedAt)));
}

/**
 * What should be in the box: the float, plus cash sales since it opened that
 * weren't voided, less cash paid out for buys. Card, transfer, PayPal and trade
 * never touch it.
 */
async function sums(db: Db, storeId: string, t: typeof till.$inferSelect) {
  const total = (v: unknown) =>
    sql<string>`coalesce(sum(${v}), 0)`.mapWith(String);
  const [[sold], [paid]] = await Promise.all([
    db
      .select({ n: total(sale.total) })
      .from(sale)
      .where(
        and(
          eq(sale.storeId, storeId),
          eq(sale.paymentMethod, "cash"),
          gte(sale.createdAt, t.openedAt),
          sql`not ${voided}`,
        ),
      ),
    db
      .select({ n: total(buy.total) })
      .from(buy)
      .where(
        and(
          eq(buy.storeId, storeId),
          eq(buy.method, "cash"),
          gte(buy.createdAt, t.openedAt),
        ),
      ),
  ]);
  const float = t.openingFloat ?? "0.00";
  return {
    float,
    cashSales: fromCents(toCents(sold.n)),
    cashBuys: fromCents(toCents(paid.n)),
    expected: fromCents(toCents(float) + toCents(sold.n) - toCents(paid.n)),
  };
}

/** The open cash box with what it should hold now, or null. */
export async function currentTill(db: Db, storeId: string) {
  const [t] = await db
    .select()
    .from(till)
    .where(and(eq(till.storeId, storeId), isNull(till.closedAt)));
  return t ? { ...t, ...(await sums(db, storeId, t)) } : null;
}

export type CheckResult =
  | { ok: true; expected: string; counted: string; already?: true }
  | { gone: true };

/**
 * The cash check: stores what was counted next to what was expected and
 * closes the box. Safe to repeat: a second check returns the first.
 */
export function closeTill(
  db: Db,
  storeId: string,
  tillId: string,
  counted: string,
): Promise<CheckResult> {
  return db.transaction(async (t) => {
    const tx = t as Db;
    const [row] = await tx
      .select()
      .from(till)
      .where(and(eq(till.id, tillId), eq(till.storeId, storeId)))
      .for("update");
    if (!row) return { gone: true };
    if (row.closedAt)
      return {
        ok: true,
        expected: row.expected!,
        counted: row.counted!,
        already: true,
      };
    const { expected } = await sums(tx, storeId, row);
    await tx
      .update(till)
      .set({ closedAt: sql`now()`, counted, expected })
      .where(eq(till.id, tillId));
    return { ok: true, expected, counted };
  });
}

/** Cash checks done in a range of days on this zone's calendar, newest first. */
export function checksIn(
  db: Db,
  storeId: string,
  r: { from: string; to: string },
  timeZone: string,
) {
  return db
    .select()
    .from(till)
    .where(
      and(
        eq(till.storeId, storeId),
        sql`${till.closedAt} >= (${r.from}::date)::timestamp at time zone ${timeZone}`,
        sql`${till.closedAt} < (${r.to}::date + 1)::timestamp at time zone ${timeZone}`,
      ),
    )
    .orderBy(desc(till.closedAt));
}
