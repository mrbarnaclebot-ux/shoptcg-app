import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CardThumb, kindOf } from "@/components/card-thumb";
import { ExportButton } from "@/components/export-button";
import { RangeForm, RangePresets } from "@/components/range-picker";
import { paidBy } from "@/components/receipt-summary";
import { StubValue, TicketLoading } from "@/components/ticket";
import { getDb } from "@/db";
import { receiptTime, shortDate, usd, withLanguage } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/receipt-email";
import {
  localDate,
  parseRange,
  salesReport,
  SALES_SHOWN,
  type Range,
} from "@/lib/reports";
import { requireStore, sellerTimeZone } from "@/lib/session";
import { shortName } from "@/lib/short-name";

export const metadata: Metadata = { title: "Report - shoptcg" };

type Search = Pick<PageProps<"/dashboard/reports">, "searchParams">;

export default function ReportPage({ searchParams }: Search) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-4 px-4 pt-8 pb-16">
      <h1 className="font-display text-[3.5rem] leading-[0.82] font-black">
        Report
      </h1>
      <Suspense fallback={<TicketLoading>Adding up the sales</TicketLoading>}>
        <Report searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const withYear = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

function rangeLabel({ from, to }: Range) {
  if (from === to) return withYear(to);
  return from.slice(0, 4) === to.slice(0, 4)
    ? `${shortDate(from)} to ${withYear(to)}`
    : `${withYear(from)} to ${withYear(to)}`;
}

function Row(props: { k: string; children: React.ReactNode; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-border py-1.5">
      <dt className={props.big ? "font-semibold" : undefined}>{props.k}</dt>
      <dd
        className={
          props.big
            ? "font-display num text-[1.875rem] leading-none font-extrabold"
            : "num font-semibold"
        }
      >
        {props.children}
      </dd>
    </div>
  );
}

const Heading = ({ children }: { children: string }) => (
  <h3 className="font-display text-[1.625rem] leading-none font-extrabold">
    {children}
  </h3>
);

type Report = Awaited<ReturnType<typeof salesReport>>;

function PaymentTable(props: {
  rows: Report["byMethod"];
  secondCurrency: string | null;
}) {
  return (
    <div>
      <Heading>How they paid</Heading>
      <table className="mt-2 w-full border-b border-border">
        <thead className="sr-only">
          <tr>
            <th scope="col">Method</th>
            <th scope="col">Sales</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((m) => {
            const cash = m.method === "cash";
            return (
              <tr key={m.method} className="border-t border-border">
                <th
                  scope="row"
                  className={`py-1.5 text-left ${cash ? "font-bold" : "font-normal"}`}
                >
                  {METHOD_LABEL[m.method]}
                </th>
                <td
                  className={`num text-right text-muted-foreground ${cash ? "font-bold" : ""}`}
                >
                  {m.sales} {m.sales === 1 ? "sale" : "sales"}
                </td>
                <td
                  className={`num pl-4 text-right ${cash ? "font-display text-[2.75rem] leading-none font-extrabold" : "font-semibold"}`}
                >
                  {usd(Number(m.total))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-sm text-muted-foreground">
        Cash sales only. Take out your starting float before you compare.
        {props.secondCurrency && " Total is in USD."}
      </p>
    </div>
  );
}

function BestSellers({ rows }: { rows: Report["bestSellers"] }) {
  return (
    <div className="mt-6">
      <Heading>Best sellers</Heading>
      <ul className="mt-2 border-b border-border">
        {rows.map((b) => (
          <li
            key={[b.name, b.setName, b.gradeLabel, b.language, b.number].join()}
            className="grid grid-cols-[34px_1fr_auto] items-center gap-2.5 border-t border-border py-1.5"
          >
            <CardThumb
              src={b.imageUrl}
              kind={kindOf(b.gradeLabel)}
              number={b.number}
              className="w-[34px]"
            />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {b.name}
              <small className="block text-sm text-muted-foreground">
                {withLanguage(
                  [b.setName, b.number, b.gradeLabel].filter(Boolean).join(" "),
                  b.language,
                )}
              </small>
            </span>
            <span className="num text-right">
              <strong>{usd(Number(b.revenue))}</strong>
              <small className="block text-sm text-muted-foreground">
                {b.qty} sold
              </small>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted-foreground">Before discounts.</p>
    </div>
  );
}

function SaleRow(props: {
  s: Report["sales"][number];
  store: string;
  oneDay: boolean;
}) {
  const { s, store } = props;
  // The sheet's heading already says the date of a single day.
  const when = props.oneDay
    ? s.createdAt.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: s.timeZone,
        timeZoneName: "short",
      })
    : receiptTime(s.createdAt, s.timeZone);
  return (
    <li className="border-t border-border">
      <details className="group">
        <summary className="grid min-h-14 cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-x-3 py-1.5">
          <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">
            {shortName(s.buyerName)}
            <small className="num block text-sm font-normal text-muted-foreground">
              {paidBy(s)}. {s.receiptNo}. {when}
            </small>
          </span>
          <span className="font-display num text-[1.625rem] leading-none font-extrabold">
            {usd(Number(s.total))}
          </span>
          <ChevronDown
            aria-hidden
            className="size-5 transition-transform group-open:rotate-180"
          />
        </summary>
        <ul className="pb-1 text-sm">
          {s.lines.map((l) => (
            <li
              key={l.lineNo}
              className="flex justify-between gap-3 border-t border-dashed border-border py-1"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {l.name}
                <small className="block text-sm text-muted-foreground">
                  {withLanguage(
                    [l.setName, l.number, l.gradeLabel]
                      .filter(Boolean)
                      .join(" "),
                    l.language,
                  )}
                </small>
              </span>
              <span className="num whitespace-nowrap">
                {l.qty} x {usd(Number(l.unitPrice))}
              </span>
            </li>
          ))}
        </ul>
        {Number(s.discount) > 0 && (
          <p className="num text-sm text-muted-foreground">
            Discount -{usd(Number(s.discount))}
          </p>
        )}
        {s.storeName !== store && (
          <p className="text-sm text-muted-foreground">Sold as {s.storeName}</p>
        )}
        <Link
          href={`/dashboard/sales/${s.id}`}
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          Open receipt {s.receiptNo}
        </Link>
      </details>
    </li>
  );
}

async function Report({ searchParams }: Search) {
  const { store } = await requireStore();
  const timeZone = await sellerTimeZone();
  const now = new Date();
  const range = parseRange(await searchParams, timeZone, now);
  const report = await salesReport(getDb(), store.id, range);
  const today = localDate(now, timeZone);
  const { summary: sum } = report;
  return (
    <>
      <RangePresets
        base="/dashboard/reports"
        label="Report range"
        range={range}
        today={today}
      />
      <section className="paper tally w-full px-5 pt-7 pb-5">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold [overflow-wrap:anywhere]">
              {store.name}
            </p>
            <h2 className="font-display text-[2.25rem] leading-[0.95] font-black">
              {rangeLabel(range)}
            </h2>
          </div>
          {store.tableLabel && <StubValue k="Table" v={store.tableLabel} />}
        </header>
        <RangeForm base="/dashboard/reports" range={range} />
        {sum.sales === 0 ? (
          <div className="pt-5">
            <p className="font-display text-[2rem] leading-none font-extrabold">
              No sales in this range.
            </p>
            <p className="mt-2 text-muted-foreground">
              Sales you confirm at the table show up here.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-6 md:grid-cols-2">
              <PaymentTable
                rows={report.byMethod}
                secondCurrency={store.secondCurrency}
              />
              <dl className="border-b border-border">
                <Row k="Revenue" big>
                  {usd(Number(sum.revenue))}
                </Row>
                <Row k="Sales">{sum.sales}</Row>
                <Row k="Items sold">{sum.items}</Row>
                <Row k="Average sale">{usd(sum.average)}</Row>
                <Row k="Discounts given">{usd(Number(sum.discounts))}</Row>
              </dl>
            </div>
            <BestSellers rows={report.bestSellers} />
            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Heading>Sales</Heading>
                <ExportButton
                  href={`/dashboard/reports/export?from=${range.from}&to=${range.to}`}
                  unit="line"
                >
                  Export CSV
                </ExportButton>
              </div>
              {sum.sales > SALES_SHOWN && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Showing the newest {SALES_SHOWN}. The CSV has all {sum.sales}.
                </p>
              )}
              <ul className="mt-2 border-b border-border">
                {report.sales.map((s) => (
                  <SaleRow
                    key={s.id}
                    s={s}
                    store={store.name}
                    oneDay={range.from === range.to}
                  />
                ))}
              </ul>
            </div>
          </>
        )}
      </section>
    </>
  );
}
