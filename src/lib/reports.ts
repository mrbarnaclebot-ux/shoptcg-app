import { and, asc, count, desc, eq, inArray, sql, sum } from "drizzle-orm";
import type { Db } from "@/db/open";
import { PAYMENT_METHODS, sale, saleLine, saleVoid } from "@/db/schema";
import { LANGUAGE_LABEL } from "@/lib/format";
import { fromCents, toCents } from "@/lib/money";
import { METHOD_LABEL } from "@/lib/receipt-email";

export const MAX_SPAN_DAYS = 366;
/** Rows drawn on the page; the summary and the CSV always cover the whole range. */
export const SALES_SHOWN = 500;

export type Range = {
  from: string;
  to: string;
  preset: "today" | "weekend" | "month" | "last-month" | "custom";
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

/** What the weekend chip is honestly called: on a weekday it's the one just gone. */
export function weekendLabel(today: string) {
  const { from, to } = weekendOf(today);
  return today === from || today === to ? "This weekend" : "Last weekend";
}

/** The calendar month a date is in, first to last day. */
export function monthOf(iso: string) {
  const from = `${iso.slice(0, 8)}01`;
  const next = new Date(`${from}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { from, to: addDays(next.toISOString().slice(0, 10), -1) };
}

/** The month before the one this date is in. */
export const lastMonthOf = (iso: string) =>
  monthOf(addDays(`${iso.slice(0, 8)}01`, -1));

/** Bad input falls back to today; a backwards range swaps; a long one is cut. */
export function parseRange(params: Params, timeZone: string, now: Date): Range {
  const today = localDate(now, timeZone);
  const a = validDate(params.from) ?? validDate(params.to) ?? today;
  const b = validDate(params.to) ?? a;
  const from = a < b ? a : b;
  const wanted = a < b ? b : a;
  const last = addDays(from, MAX_SPAN_DAYS - 1);
  const to = wanted > last ? last : wanted;
  const is = (r: { from: string; to: string }) =>
    from === r.from && to === r.to;
  const preset = is({ from: today, to: today })
    ? "today"
    : is(weekendOf(today))
      ? "weekend"
      : is(monthOf(today))
        ? "month"
        : is(lastMonthOf(today))
          ? "last-month"
          : "custom";
  return { from, to, preset };
}

export const voided = sql<boolean>`exists (select 1 from ${saleVoid} where ${saleVoid.saleId} = ${sale.id})`;
const notVoided = sql`not ${voided}`;

// A sale belongs to the day on its receipt, in the zone it was sold in, so a past
// show's report doesn't change when the seller travels. The expression can't use
// the index; the UTC bounds, a day wider than any zone's offset, can.
// A voided sale is in no total: report, CSV and ledger all read through here.
export const inRange = (storeId: string, r: Pick<Range, "from" | "to">) =>
  and(
    eq(sale.storeId, storeId),
    notVoided,
    sql`${sale.createdAt} >= (${r.from}::date - 1)::timestamp at time zone 'UTC'`,
    sql`${sale.createdAt} < (${r.to}::date + 2)::timestamp at time zone 'UTC'`,
    sql`${sale.createdAt} >= (${r.from}::date)::timestamp at time zone ${sale.timeZone}`,
    sql`${sale.createdAt} < (${r.to}::date + 1)::timestamp at time zone ${sale.timeZone}`,
  );

export async function salesReport(
  db: Db,
  storeId: string,
  r: Pick<Range, "from" | "to">,
) {
  const where = inRange(storeId, r);
  const revenueOf = sql`sum(${saleLine.qty} * ${saleLine.unitPrice})`;
  // The receipt's own day, as inRange counts it.
  const dayOf = sql<string>`to_char(${sale.createdAt} at time zone ${sale.timeZone}, 'YYYY-MM-DD')`;
  // One snapshot, so a sale landing mid-read can't split the count from the cash.
  const { totals, items, methods, bestSellers, sales, lines, days } =
    await db.transaction(
      async (tx) => {
        const [[totals], [items], methods, bestSellers, sales, days] =
          await Promise.all([
            tx
              .select({
                sales: count(),
                revenue: sum(sale.total),
                discounts: sum(sale.discount),
              })
              .from(sale)
              .where(where),
            tx
              .select({ items: sum(saleLine.qty) })
              .from(saleLine)
              .innerJoin(sale, eq(sale.id, saleLine.saleId))
              .where(where),
            tx
              .select({
                method: sale.paymentMethod,
                sales: count(),
                total: sum(sale.total),
              })
              .from(sale)
              .where(where)
              .groupBy(sale.paymentMethod),
            tx
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
            tx
              .select()
              .from(sale)
              .where(where)
              .orderBy(desc(sale.createdAt))
              .limit(SALES_SHOWN),
            tx
              .select({
                day: dayOf,
                sales: count(),
                cash: sql<string>`coalesce(sum(${sale.total}) filter (where ${sale.paymentMethod} = 'cash'), 0)`,
                total: sql<string>`sum(${sale.total})`,
              })
              .from(sale)
              .where(where)
              .groupBy(dayOf)
              .orderBy(dayOf),
          ]);
        const lines = sales.length
          ? await tx
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
        return { totals, items, methods, bestSellers, sales, lines, days };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
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
    // Days with a sale, oldest first. Card and the rest is the total less cash.
    days: days.map((d) => ({
      day: d.day,
      sales: d.sales,
      cash: d.cash,
      other: fromCents(toCents(d.total) - toCents(d.cash)),
      total: d.total,
    })),
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
  "line_total",
  "sale_discount",
  "sale_total",
  "payment_method",
  "payment_note",
];

/** Each line's share of the sale's total, in cents; rounded so they sum to it exactly. */
export function lineTotals(
  lines: { qty: number; unitPrice: string }[],
  total: number,
) {
  const gross = lines.map((l) => toCents(l.unitPrice) * l.qty);
  const all = gross.reduce((a, b) => a + b, 0);
  let sofar = 0;
  let given = 0;
  return gross.map((g) => {
    sofar += g;
    const upTo = all ? Math.round((sofar * total) / all) : total;
    const share = upTo - given;
    given = upTo;
    return share;
  });
}

/**
 * One row per sold line; the buyer's first name only, never their email. So a sum
 * matches the cash box, line_total adds up to revenue, and the sale's own amounts
 * are on its first line only.
 */
export async function reportCsvRows(
  db: Db,
  storeId: string,
  r: Pick<Range, "from" | "to">,
) {
  const rows = await db
    .select({ sale, line: saleLine })
    .from(saleLine)
    .innerJoin(sale, eq(sale.id, saleLine.saleId))
    .where(inRange(storeId, r))
    .orderBy(asc(sale.createdAt), asc(sale.seq), asc(saleLine.lineNo));
  return [
    REPORT_CSV_HEADER,
    ...[...Map.groupBy(rows, (x) => x.sale.id).values()].flatMap((group) => {
      const s = group[0].sale;
      const shares = lineTotals(
        group.map((x) => x.line),
        toCents(s.total),
      );
      return group.map(({ line: l }, i) => [
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
        fromCents(shares[i]),
        i === 0 ? s.discount : null,
        i === 0 ? s.total : null,
        METHOD_LABEL[s.paymentMethod],
        s.paymentNote,
      ]);
    }),
  ];
}
