import { and, asc, desc, eq, sql, type Column } from "drizzle-orm";
import type { Db } from "@/db/open";
import {
  catalogItem,
  listing,
  sale,
  saleLine,
  stockMove,
  STOCK_REASONS,
  type BuyMethod,
} from "@/db/schema";
import { buysIn } from "@/lib/buys";
import { stockValue } from "@/lib/listings";
import { fromCents, toCents } from "@/lib/money";
import { METHOD_LABEL } from "@/lib/receipt-email";
import { inRange, localDate, type Range } from "@/lib/reports";
import { checksIn } from "@/lib/till";

export type StockReason = (typeof STOCK_REASONS)[number];

/** Stock moves drawn on the ledger page, newest first. */
export const MOVES_SHOWN = 300;

/** How each stock move reads on the ledger page and in its CSV. */
export const MOVE_LABEL: Record<StockReason, string> = {
  opening: "Opening stock",
  added: "Added",
  adjusted: "Adjusted",
  sold: "Sold",
  voided: "Sale voided",
  bought: "Bought",
  removed: "Removed",
  restored: "Restored",
  counted: "Stock count",
  damaged: "Damaged",
  lost: "Lost",
};

export const PAID_WITH: Record<BuyMethod, string> = {
  cash: "Cash",
  card: "Card",
  paypal: "PayPal",
  trade: "Trade",
};

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

const own = <T>(mine: Column, cat: Column) => sql<T>`coalesce(${mine}, ${cat})`;

/**
 * Stock moves in these days on this zone's calendar, with what they moved:
 * set, number, and condition or grade. Newest first with a limit, for the
 * page; oldest first and all of them, for the CSV.
 */
function movesIn(
  db: Db,
  storeId: string,
  r: Pick<Range, "from" | "to">,
  timeZone: string,
  newest?: number,
) {
  const q = db
    .select({
      id: stockMove.id,
      at: stockMove.at,
      delta: stockMove.delta,
      qtyAfter: stockMove.qtyAfter,
      reason: stockMove.reason,
      name: own<string | null>(listing.name, catalogItem.name),
      setName: own<string | null>(listing.setName, catalogItem.setName),
      number: own<string | null>(listing.number, catalogItem.number),
      condition: sql<string | null>`coalesce(${listing.condition},
        nullif(concat_ws(' ', ${own(listing.grader, catalogItem.grader)}, ${own(listing.grade, catalogItem.grade)}), ''))`,
      language: listing.language,
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
    );
  return newest
    ? q.orderBy(desc(stockMove.at), desc(stockMove.id)).limit(newest)
    : q.orderBy(asc(stockMove.at), asc(stockMove.id));
}

/** Takings, profit where the cost is known, stock on hand and every stock move. */
export async function ledger(
  db: Db,
  storeId: string,
  r: Pick<Range, "from" | "to">,
  timeZone: string,
) {
  const [[money], moves, stock, buys, checks] = await Promise.all([
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
    movesIn(db, storeId, r, timeZone, MOVES_SHOWN),
    stockValue(db, storeId),
    buysIn(db, storeId, r, timeZone),
    checksIn(db, storeId, r, timeZone),
  ]);
  return {
    money: { ...money, profit: money.costedRevenue - money.cost },
    stock,
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

export const LEDGER_CSV_HEADER = [
  "date",
  "time",
  "entry",
  "item",
  "set",
  "number",
  "condition",
  "qty_change",
  "qty_after",
  "money_in",
  "money_out",
  "method",
  "receipt_no",
];

/**
 * Everything the ledger page shows for these days, oldest first: each stock
 * move with what it moved, each sale's takings and each buy's payout. A sale's
 * items are its "Sold" moves; its money is the "Sale" row, so the money
 * columns add up to takings and buys.
 */
export async function ledgerCsvRows(
  db: Db,
  storeId: string,
  r: Pick<Range, "from" | "to">,
  timeZone: string,
) {
  const [moves, sales, buys] = await Promise.all([
    movesIn(db, storeId, r, timeZone),
    db
      .select({
        at: sale.createdAt,
        total: sale.total,
        method: sale.paymentMethod,
        receiptNo: sale.receiptNo,
      })
      .from(sale)
      .where(inRange(storeId, r)),
    buysIn(db, storeId, r, timeZone),
  ]);
  const time = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone,
  });
  const row = (at: Date, cells: (string | number | null)[]) => ({
    at,
    cells: [localDate(at, timeZone), time.format(at), ...cells],
  });
  const rows = [
    ...moves.map((m) =>
      row(m.at, [
        MOVE_LABEL[m.reason],
        m.name ?? "Removed item",
        m.setName,
        m.number,
        m.condition,
        m.delta,
        m.qtyAfter,
        null,
        null,
        null,
        m.receiptNo,
      ]),
    ),
    ...sales.map((s) =>
      row(s.at, [
        "Sale",
        ...Array(6).fill(null),
        s.total,
        null,
        METHOD_LABEL[s.method],
        s.receiptNo,
      ]),
    ),
    ...buys.map((b) =>
      row(b.createdAt, [
        "Buy",
        b.lines.map((l) => l.name).join(", "),
        ...Array(5).fill(null),
        null,
        b.total,
        PAID_WITH[b.method],
        null,
      ]),
    ),
  ];
  // Stable, so a sale's own moves keep their order around it.
  rows.sort((a, b) => +a.at - +b.at);
  return [LEDGER_CSV_HEADER, ...rows.map((x) => x.cells)];
}
