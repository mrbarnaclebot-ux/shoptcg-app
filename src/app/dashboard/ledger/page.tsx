import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { RangeForm, RangePresets } from "@/components/range-picker";
import { SectionMark } from "@/components/section-mark";
import { TicketLoading } from "@/components/ticket";
import { getDb } from "@/db";
import { usd } from "@/lib/format";
import { ledger, MOVES_SHOWN, type StockReason } from "@/lib/ledger";
import { localDate, parseRange } from "@/lib/reports";
import { requireStore, sellerTimeZone } from "@/lib/session";

export const metadata: Metadata = { title: "Ledger - shoptcg" };

type Search = Pick<PageProps<"/dashboard/ledger">, "searchParams">;

const BASE = "/dashboard/ledger";
const REASON: Record<StockReason, string> = {
  opening: "Opening stock",
  added: "Added",
  adjusted: "Adjusted",
  sold: "Sold",
  voided: "Sale voided",
};

export default function LedgerPage({ searchParams }: Search) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-6 px-4 pt-8 pb-16">
      <h1 className="font-display text-[3.5rem] leading-[0.82] font-black">
        Ledger
      </h1>
      <Suspense fallback={<TicketLoading>Adding it up</TicketLoading>}>
        <Ledger searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function Row(props: { k: string; children: ReactNode; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border py-2">
      <dt className={props.big ? "font-semibold" : "text-muted-foreground"}>
        {props.k}
      </dt>
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

const units = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

async function Ledger({ searchParams }: Search) {
  const { store } = await requireStore();
  const timeZone = await sellerTimeZone();
  const now = new Date();
  const range = parseRange(await searchParams, timeZone, now);
  const { money, stock, moves } = await ledger(
    getDb(),
    store.id,
    range,
    timeZone,
  );
  const time = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  return (
    <>
      <div className="w-full">
        <RangePresets
          base={BASE}
          label="Ledger range"
          range={range}
          today={localDate(now, timeZone)}
        />
        <RangeForm base={BASE} range={range} />
      </div>

      <section aria-labelledby="money-h" className="flex w-full flex-col gap-3">
        <SectionMark n={1} id="money-h">
          Money in these days
        </SectionMark>
        <dl className="border-b border-border">
          <Row k="Takings, after discounts">{usd(money.revenue)}</Row>
          <Row k="Sold">{units(money.units)}</Row>
          <Row k="What those items cost you">{usd(money.cost)}</Row>
          <Row k="Profit" big>
            {usd(money.profit)}
          </Row>
        </dl>
        {money.uncostedUnits > 0 && (
          <p className="text-sm text-muted-foreground">
            {units(money.uncostedUnits)} sold had no cost entered, so profit
            leaves {money.uncostedUnits === 1 ? "it" : "them"} out. Add what you
            paid when you edit an item in Inventory.
          </p>
        )}
      </section>

      <section aria-labelledby="stock-h" className="flex w-full flex-col gap-3">
        <SectionMark n={2} id="stock-h">
          Stock right now
        </SectionMark>
        <dl className="border-b border-border">
          <Row k="On hand">
            {units(stock.units)} in {stock.lines}{" "}
            {stock.lines === 1 ? "listing" : "listings"}
          </Row>
          <Row k="Worth at market price">{usd(stock.atMarket)}</Row>
          <Row k="What it cost you">{usd(stock.atCost)}</Row>
        </dl>
        {stock.uncostedUnits > 0 && (
          <p className="text-sm text-muted-foreground">
            {units(stock.uncostedUnits)} on hand{" "}
            {stock.uncostedUnits === 1 ? "has" : "have"} no cost entered.
          </p>
        )}
      </section>

      <section aria-labelledby="moves-h" className="flex w-full flex-col gap-3">
        <SectionMark n={3} id="moves-h">
          Stock in and out
        </SectionMark>
        {moves.length === 0 ? (
          <p className="text-muted-foreground">
            No stock changed in these days.
          </p>
        ) : (
          <ul className="w-full border-b border-border">
            {moves.map((m) => (
              <li
                key={m.id}
                className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-t border-border py-2"
              >
                <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                  {m.name ?? "Removed item"}
                  <small className="block text-sm font-normal text-muted-foreground">
                    {time.format(m.at)}. {REASON[m.reason]}
                    {m.saleId && m.receiptNo && (
                      <>
                        ,{" "}
                        <Link
                          href={`/dashboard/sales/${m.saleId}`}
                          className="underline underline-offset-2"
                        >
                          {m.receiptNo}
                        </Link>
                      </>
                    )}
                    . {m.qtyAfter} left.
                  </small>
                </span>
                <span
                  className={`font-display num text-[1.5rem] leading-none font-extrabold ${m.delta < 0 ? "" : "text-success"}`}
                >
                  {m.delta > 0 ? "+" : "−"}
                  {Math.abs(m.delta)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {moves.length === MOVES_SHOWN && (
          <p className="text-sm text-muted-foreground">
            Showing the newest {MOVES_SHOWN}. Pick fewer days to see the rest.
          </p>
        )}
      </section>
    </>
  );
}
