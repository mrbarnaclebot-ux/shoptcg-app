import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import {
  catalogItem,
  listing,
  sale,
  saleLine,
  stockMove,
  STOCK_REASONS,
} from "@/db/schema";
import { buysIn } from "@/lib/buys";
import { listStock } from "@/lib/listings";
import { fromCents, toCents } from "@/lib/money";
import { inRange, type Range } from "@/lib/reports";
import { checksIn } from "@/lib/till";

export type StockReason = (typeof STOCK_REASONS)[number];

/** Stock moves drawn on the ledger page, newest first. */
export const MOVES_SHOWN = 300;

/**
 * Labels the stock changes made in the rest of this transaction. The
 * listing_stock_move trigger reads it; unlabelled changes are "adjusted".
 */
export async function stockReason(tx: Db, reason: StockReason, ref?: string) {
  await tx.execute(
    sql`select set_config('app.stock_reason', ${reason}, true), set_config('app.stock_ref', ${ref ?? ""}, true)`,
  );
}

// A line's share of the sale after its discount, so profit matches the cash.
const net = sql`${saleLine.qty} * ${saleLine.unitPrice} * (case when ${sale.subtotal} > 0 then ${sale.total} / ${sale.subtotal} else 1 end)`;

/** Takings, profit where the cost is known, stock on hand and every stock move. */
export async function ledger(
  db: Db,
  storeId: string,
  r: Pick<Range, "from" | "to">,
  timeZone: string,
) {
  const [[money], moves, active, hidden, buys, checks] = await Promise.all([
    db
      .select({
        revenue: sql<string>`coalesce(sum(${net}), 0)`.mapWith(Number),
        units: sql<string>`coalesce(sum(${saleLine.qty}), 0)`.mapWith(Number),
        // Only lines with a cost can say anything about profit.
        costedRevenue:
          sql<string>`coalesce(sum(${net}) filter (where ${saleLine.unitCost} is not null), 0)`.mapWith(
            Number,
          ),
        cost: sql<string>`coalesce(sum(${saleLine.qty} * ${saleLine.unitCost}), 0)`.mapWith(
          Number,
        ),
        uncostedUnits:
          sql<string>`coalesce(sum(${saleLine.qty}) filter (where ${saleLine.unitCost} is null), 0)`.mapWith(
            Number,
          ),
      })
      .from(saleLine)
      .innerJoin(sale, eq(sale.id, saleLine.saleId))
      .where(inRange(storeId, r)),
    db
      .select({
        id: stockMove.id,
        at: stockMove.at,
        delta: stockMove.delta,
        qtyAfter: stockMove.qtyAfter,
        reason: stockMove.reason,
        name: sql<
          string | null
        >`coalesce(${listing.name}, ${catalogItem.name})`,
        saleId: sale.id,
        receiptNo: sale.receiptNo,
      })
      .from(stockMove)
      .leftJoin(listing, eq(listing.id, stockMove.listingId))
      .leftJoin(catalogItem, eq(catalogItem.id, listing.catalogItemId))
      .leftJoin(sale, eq(sale.id, stockMove.ref))
      .where(
        and(
          eq(stockMove.storeId, storeId),
          sql`${stockMove.at} >= (${r.from}::date)::timestamp at time zone ${timeZone}`,
          sql`${stockMove.at} < (${r.to}::date + 1)::timestamp at time zone ${timeZone}`,
        ),
      )
      .orderBy(desc(stockMove.at), desc(stockMove.id))
      .limit(MOVES_SHOWN),
    listStock(db, storeId),
    listStock(db, storeId, { kind: "hidden" }),
    buysIn(db, storeId, r, timeZone),
    checksIn(db, storeId, r, timeZone),
  ]);
  const held = [...active, ...hidden].filter((s) => s.qty > 0);
  const total = (of: (s: (typeof held)[number]) => number | null) =>
    held.reduce((sum, s) => sum + (of(s) ?? 0) * s.qty, 0);
  return {
    money: { ...money, profit: money.costedRevenue - money.cost },
    stock: {
      units: held.reduce((n, s) => n + s.qty, 0),
      lines: held.length,
      atCost: total((s) => s.cost),
      uncostedUnits: held
        .filter((s) => s.cost === null)
        .reduce((n, s) => n + s.qty, 0),
      atMarket: total((s) => s.market),
    },
    moves,
    // Money out: never in takings or profit. Bought units reach profit
    // through listing.cost, copied to each sold line.
    buys: {
      list: buys,
      paid: fromCents(buys.reduce((c, b) => c + toCents(b.total), 0)),
      cash: fromCents(
        buys
          .filter((b) => b.method === "cash")
          .reduce((c, b) => c + toCents(b.total), 0),
      ),
    },
    checks,
  };
}
