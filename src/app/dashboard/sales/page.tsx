import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { paidBy } from "@/components/receipt-summary";
import { getDb } from "@/db";
import { usd } from "@/lib/format";
import { salesToday } from "@/lib/sales";
import { requireStore } from "@/lib/session";
import { shortName } from "@/lib/short-name";

export const metadata: Metadata = { title: "Sales - shoptcg" };

export default function SalesPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start gap-3 px-4 pt-8 pb-16">
      <h1 className="font-display text-[3.5rem] leading-[0.82] font-black">
        Sales
      </h1>
      <Suspense
        fallback={<div className="h-40 w-full animate-pulse bg-surface" />}
      >
        <Today />
      </Suspense>
    </main>
  );
}

async function Today() {
  const { store } = await requireStore();
  const sales = await salesToday(getDb(), store.id);
  if (!sales.length)
    return (
      <>
        <p className="font-display mt-6 border-t border-dashed border-border-strong pt-5 text-[2rem] leading-none font-extrabold">
          No sales today.
        </p>
        <p className="max-w-[44ch] text-muted-foreground">
          Confirmed sales and receipts show up here once you confirm a
          buyer&apos;s request.
        </p>
      </>
    );
  return (
    <ul className="mt-4 w-full border-b border-border">
      {sales.map((s) => (
        <li key={s.id} className="border-t border-border">
          <Link
            href={`/dashboard/sales/${s.id}`}
            className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-x-3 py-2 hover:bg-surface"
          >
            <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">
              {shortName(s.buyerName)}
              <small className="num block text-[0.8125rem] font-normal text-muted-foreground">
                {s.receiptNo}.{" "}
                {s.createdAt.toLocaleTimeString("en-US", {
                  timeStyle: "short",
                  timeZone: "UTC",
                })}{" "}
                UTC. {s.items} {s.items === 1 ? "item" : "items"}.{" "}
                {paidBy({ paymentMethod: s.method, paymentNote: null })}
              </small>
            </span>
            <span className="font-display num text-[1.875rem] leading-none font-extrabold">
              {usd(Number(s.total))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
