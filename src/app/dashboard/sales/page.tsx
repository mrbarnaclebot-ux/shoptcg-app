import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { paidBy } from "@/components/receipt-summary";
import { BookOpen, ChartColumn, ChevronLeft, ChevronRight } from "lucide-react";
import { Stamp } from "@/components/stamp";
import { lineButton } from "@/components/ticket-button";
import { TicketLoading } from "@/components/ticket";
import { getDb } from "@/db";
import { usd } from "@/lib/format";
import { addDays, localDate, parseRange } from "@/lib/reports";
import { salesOn } from "@/lib/sales";
import { requireStore, sellerTimeZone } from "@/lib/session";
import { shortName } from "@/lib/short-name";

export const metadata: Metadata = { title: "Sales - tcgmart" };

type Search = Pick<PageProps<"/dashboard/sales">, "searchParams">;

export default function SalesPage({ searchParams }: Search) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start gap-3 px-4 pt-8 pb-16 lg:max-w-[1280px] lg:px-8">
      <div className="flex w-full flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[3.5rem] leading-[0.82] font-black">
          Sales
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/ledger" className={lineButton}>
            <BookOpen aria-hidden className="size-5" />
            Ledger
          </Link>
          <Link href="/dashboard/reports" className={lineButton}>
            <ChartColumn aria-hidden className="size-5" />
            Report
          </Link>
        </div>
      </div>
      <Suspense fallback={<TicketLoading>Loading sales</TicketLoading>}>
        <Day searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const dayName = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Earlier and later days, kept in the URL, for a show that runs Friday to Sunday. */
function DayNav(props: { day: string; today: string }) {
  const later = addDays(props.day, 1);
  return (
    <nav aria-label="Day" className="flex w-full flex-wrap gap-2">
      <Link
        href={`/dashboard/sales?day=${addDays(props.day, -1)}`}
        className={lineButton}
      >
        <ChevronLeft aria-hidden className="size-5" />
        Previous day
      </Link>
      {props.day < props.today && (
        <Link
          href={
            later === props.today
              ? "/dashboard/sales"
              : `/dashboard/sales?day=${later}`
          }
          className={lineButton}
        >
          Next day
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      )}
    </nav>
  );
}

async function Day({ searchParams }: Search) {
  const { store } = await requireStore();
  const timeZone = await sellerTimeZone();
  const now = new Date();
  const today = localDate(now, timeZone);
  // A bad date falls back to today, and there are no sales tomorrow.
  const asked = parseRange({ from: (await searchParams).day }, timeZone, now);
  const day = asked.from > today ? today : asked.from;
  const name =
    day === today ? "Today" : dayName.format(new Date(`${day}T00:00:00Z`));
  const sales = await salesOn(getDb(), store.id, timeZone, day);
  const kept = sales.filter((s) => !s.voided);
  const takings = kept.reduce((sum, s) => sum + Number(s.total), 0);
  const nav = (
    <>
      <DayNav day={day} today={today} />
      <h2 className="font-display text-[2rem] leading-none font-extrabold">
        {name}
      </h2>
    </>
  );
  if (!sales.length)
    return (
      <>
        {nav}
        <p className="font-display mt-6 border-t border-dashed border-border-strong pt-5 text-[2rem] leading-none font-extrabold">
          {day === today ? "No sales today." : `No sales on ${name}.`}
        </p>
        <p className="max-w-[44ch] text-muted-foreground">
          Confirmed sales and receipts show up here once you confirm a
          buyer&apos;s request.
        </p>
      </>
    );
  const items = kept.reduce((n, s) => n + s.items, 0);
  const voided = sales.length - kept.length;
  return (
    <>
      {nav}
      {/* Desktop: the day's totals in a tile beside the list. */}
      <div className="flex w-full flex-col items-start gap-3 lg:mt-4 lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-start lg:gap-0 lg:border lg:border-border">
        {/* The phone's one line; on desktop the tile beside the list. */}
        <div className="flex flex-col gap-4 lg:self-stretch lg:border-r lg:border-border lg:p-8">
          <p className="num text-lg font-semibold">
            {kept.length} {kept.length === 1 ? "sale" : "sales"}, {usd(takings)}
          </p>
          <p className="font-display num hidden text-[3rem] leading-none font-extrabold lg:block">
            {usd(takings)}
          </p>
          <p className="num hidden text-sm text-muted-foreground lg:block">
            {items} {items === 1 ? "item" : "items"} sold.
            {voided > 0 && ` ${voided} voided, left out of the total.`}
          </p>
        </div>
        <ul className="mt-1 w-full border-b border-border lg:mt-0 lg:border-b-0 lg:px-8 lg:py-4">
          {sales.map((s) => (
            <li key={s.id} className="border-t border-border">
              <Link
                href={`/dashboard/sales/${s.id}`}
                className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-x-3 py-2 hover:bg-surface"
              >
                <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                  {shortName(s.buyerName)}
                  {s.voided && (
                    <Stamp className="ml-2 align-middle">Voided</Stamp>
                  )}
                  <small className="num block text-sm font-normal text-muted-foreground">
                    {s.receiptNo}.{" "}
                    {s.createdAt.toLocaleTimeString("en-US", {
                      timeStyle: "short",
                      timeZone: s.timeZone,
                    })}
                    . {s.items} {s.items === 1 ? "item" : "items"}.{" "}
                    {paidBy({ paymentMethod: s.method, paymentNote: null })}
                  </small>
                </span>
                <span
                  className={`font-display num text-[1.875rem] leading-none font-extrabold ${s.voided ? "text-muted-foreground line-through" : ""}`}
                >
                  {usd(Number(s.total))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
