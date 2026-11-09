import { and, asc, count, desc, eq, inArray, sql, sum } from "drizzle-orm";
import type { Db } from "@/db/open";
import { PAYMENT_METHODS, sale, saleLine } from "@/db/schema";
import { LANGUAGE_LABEL } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/receipt-email";

export const MAX_SPAN_DAYS = 366;
/** Rows drawn on the page; the summary and the CSV always cover the whole range. */
export const SALES_SHOWN = 500;

export type Range = {
  from: string;
  to: string;
  timeZone: string;
  preset: "today" | "weekend" | "custom";
};

type Params = Record<string, string | string[] | undefined>;

// Building a formatter is slow enough to show on a 20,000 line export.
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(
  locale: string,
  timeZone: string,
  o: Intl.DateTimeFormatOptions,
) {
  const key = `${locale} ${timeZone}`;
  let f = formatters.get(key);
  if (!f)
    formatters.set(
      key,
      (f = new Intl.DateTimeFormat(locale, { ...o, timeZone })),
    );
  return f;
}

/** A date (YYYY-MM-DD) on the calendar of this zone. */
export const localDate = (at: Date, timeZone: string) =>
  formatter("en-CA", timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A real calendar date in a sane range: Postgres errors on year 0000 and Feb 30. */
function validDate(v: Params[string]) {
  if (typeof v !== "string" || !/^20\d\d-\d\d-\d\d$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(+d) && d.toISOString().startsWith(v) ? v : null;
}

/** The Saturday and Sunday this date is in, or else the most recent pair. */
export function weekendOf(today: string) {
  const day = new Date(`${today}T00:00:00Z`).getUTCDay();
  const sat = addDays(today, day === 6 ? 0 : -(day + 1));
  return { from: sat, to: addDays(sat, 1) };
}

/** Bad input falls back to today; a backwards range swaps; a long one is cut. */
export function parseRange(params: Params, timeZone: string, now: Date): Range {
  const today = localDate(now, timeZone);
  const a = validDate(params.from) ?? validDate(params.to) ?? today;
  const b = validDate(params.to) ?? a;
  const from = a < b ? a : b;
  const wanted = a < b ? b : a;
  const last = addDays(from, MAX_SPAN_DAYS - 1);
  const to = wanted > last ? last : wanted;
  const weekend = weekendOf(today);
  const preset =
    from === today && to === today
      ? "today"
      : from === weekend.from && to === weekend.to
        ? "weekend"
        : "custom";
  return { from, to, timeZone, preset };
}

// Which days a sale falls on is the seller's zone today. Its printed time stays
// in the zone stored on the sale, so a receipt reads the same wherever they are.
const inRange = (storeId: string, r: Range) =>
  and(
    eq(sale.storeId, storeId),
    sql`${sale.createdAt} >= (${r.from}::date)::timestamp at time zone ${r.timeZone}`,
    sql`${sale.createdAt} < (${r.to}::date + 1)::timestamp at time zone ${r.timeZone}`,
  );

export async function salesReport(db: Db, storeId: string, r: Range) {
  const where = inRange(storeId, r);
  const revenueOf = sql`sum(${saleLine.qty} * ${saleLine.unitPrice})`;
  const [[totals], [items], methods, bestSellers, sales] = await Promise.all([
    db
      .select({
        sales: count(),
        revenue: sum(sale.total),
        discounts: sum(sale.discount),
      })
      .from(sale)
      .where(where),
    db
      .select({ items: sum(saleLine.qty) })
      .from(saleLine)
      .innerJoin(sale, eq(sale.id, saleLine.saleId))
      .where(where),
    db
      .select({
        method: sale.paymentMethod,
        sales: count(),
        total: sum(sale.total),
      })
      .from(sale)
      .where(where)
      .groupBy(sale.paymentMethod),
    db
      .select({
        name: saleLine.name,
        gradeLabel: saleLine.gradeLabel,
        language: saleLine.language,
        setName: sql<string | null>`max(${saleLine.setName})`,
        number: sql<string | null>`max(${saleLine.number})`,
        imageUrl: sql<string | null>`max(${saleLine.imageUrl})`,
        qty: sum(saleLine.qty).mapWith(Number),
        revenue: sql<string>`${revenueOf}`,
      })
      .from(saleLine)
      .innerJoin(sale, eq(sale.id, saleLine.saleId))
      .where(where)
      .groupBy(
        sql`coalesce(${saleLine.catalogItemId}::text, ${saleLine.name})`,
        saleLine.name,
        saleLine.gradeLabel,
        saleLine.language,
      )
      .orderBy(sql`${revenueOf} desc`, saleLine.name)
      .limit(10),
    db
      .select()
      .from(sale)
      .where(where)
      .orderBy(desc(sale.createdAt))
      .limit(SALES_SHOWN),
  ]);
  const lines = sales.length
    ? await db
        .select()
        .from(saleLine)
        .where(
          inArray(
            saleLine.saleId,
            sales.map((s) => s.id),
          ),
        )
        .orderBy(saleLine.lineNo)
    : [];
  const byId = Map.groupBy(lines, (l) => l.saleId);
  const revenue = totals.revenue ?? "0";
  return {
    summary: {
      sales: totals.sales,
      revenue,
      items: Number(items.items ?? 0),
      average: totals.sales ? Number(revenue) / totals.sales : 0,
      discounts: totals.discounts ?? "0",
    },
    // Fixed order with empty rows, so the cash line is always in the same place.
    byMethod: PAYMENT_METHODS.map((method) => {
      const m = methods.find((x) => x.method === method);
      return { method, sales: m?.sales ?? 0, total: m?.total ?? "0" };
    }),
    bestSellers,
    sales: sales.map((s) => ({ ...s, lines: byId.get(s.id) ?? [] })),
  };
}

export const REPORT_CSV_HEADER = [
  "date",
  "time",
  "receipt_no",
  "buyer_first_name",
  "item",
  "set",
  "number",
  "grade",
  "language",
  "qty",
  "unit_price",
  "sale_discount",
  "sale_total",
  "payment_method",
];

/** One row per sold line; the buyer's first name only, never their email. */
export async function reportCsvRows(db: Db, storeId: string, r: Range) {
  const rows = await db
    .select({ sale, line: saleLine })
    .from(saleLine)
    .innerJoin(sale, eq(sale.id, saleLine.saleId))
    .where(inRange(storeId, r))
    .orderBy(asc(sale.createdAt), asc(sale.seq), asc(saleLine.lineNo));
  return [
    REPORT_CSV_HEADER,
    ...rows.map(({ sale: s, line: l }) => [
      localDate(s.createdAt, s.timeZone),
      formatter("en-US", s.timeZone, { timeStyle: "short" }).format(
        s.createdAt,
      ),
      s.receiptNo,
      s.buyerName.trim().split(/\s+/)[0],
      l.name,
      l.setName,
      l.number,
      l.gradeLabel,
      LANGUAGE_LABEL[l.language as keyof typeof LANGUAGE_LABEL] ?? l.language,
      l.qty,
      l.unitPrice,
      s.discount,
      s.total,
      s.paymentNote
        ? `${METHOD_LABEL[s.paymentMethod]}: ${s.paymentNote}`
        : METHOD_LABEL[s.paymentMethod],
    ]),
  ];
}
