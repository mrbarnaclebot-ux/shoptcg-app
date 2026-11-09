import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExportButton } from "@/components/export-button";
import { lineButton } from "@/components/ticket-button";
import { TicketLoading } from "@/components/ticket";
import { getDb } from "@/db";
import {
  CUSTOMERS_SHOWN,
  listCustomers,
  promoStatus,
  subscribedCount,
} from "@/lib/customers";
import { requireStore, sellerTimeZone } from "@/lib/session";
import { RemoveCustomer } from "./remove-customer";

export const metadata: Metadata = { title: "Customers - shoptcg" };

type Search = Pick<PageProps<"/dashboard/customers">, "searchParams">;

export default function CustomersPage({ searchParams }: Search) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start gap-4 px-4 pt-8 pb-16">
      <h1 className="font-display text-[3.5rem] leading-[0.82] font-black">
        Customers
      </h1>
      <Suspense fallback={<TicketLoading>Finding your buyers</TicketLoading>}>
        <Customers searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const param = (v: string | string[] | undefined) =>
  typeof v === "string" ? v.trim().slice(0, 100) : "";

function Chip(props: { href: string; on: boolean; children: string }) {
  return (
    <Link
      href={props.href}
      aria-current={props.on ? "page" : undefined}
      className={
        props.on
          ? "grid h-11 place-items-center bg-text px-3.5 font-semibold text-bg"
          : "grid h-11 place-items-center px-3.5 font-medium text-muted-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]"
      }
    >
      {props.children}
    </Link>
  );
}

async function Customers({ searchParams }: Search) {
  const { store } = await requireStore();
  const timeZone = await sellerTimeZone();
  const params = await searchParams;
  const q = param(params.q);
  const subscribed = params.show === "subscribed";
  const db = getDb();
  const [rows, optedIn] = await Promise.all([
    listCustomers(db, store.id, { subscribed, q }),
    subscribedCount(db, store.id),
  ]);
  const qs = q ? `q=${encodeURIComponent(q)}` : "";
  return (
    <>
      <nav aria-label="Filter customers" className="flex flex-wrap gap-2">
        <Chip href={`/dashboard/customers?${qs}`} on={!subscribed}>
          All
        </Chip>
        <Chip
          href={`/dashboard/customers?show=subscribed&${qs}`}
          on={subscribed}
        >
          Subscribed
        </Chip>
      </nav>
      <form
        action="/dashboard/customers"
        role="search"
        className="flex w-full gap-2"
      >
        {subscribed && <input type="hidden" name="show" value="subscribed" />}
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search by name or email</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={100}
            placeholder="Name or email"
            className="h-12 w-full border border-border-strong bg-transparent px-3 text-base"
          />
        </label>
        <button type="submit" className={lineButton}>
          Search
        </button>
      </form>

      <section className="paper tally w-full px-5 pt-7 pb-5">
        {rows.length === 0 ? (
          <>
            <p className="font-display text-[2rem] leading-none font-extrabold">
              {q || subscribed ? "No one matches that." : "No customers yet."}
            </p>
            <p className="mt-2 text-muted-foreground">
              Buyers appear here after their first confirmed sale.
            </p>
          </>
        ) : (
          <ul className="border-b border-border">
            {rows.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-0.5 border-t border-border py-3"
              >
                <span className="font-semibold [overflow-wrap:anywhere]">
                  {c.name}
                </span>
                <span className="[overflow-wrap:anywhere]">{c.email}</span>
                <span className="num text-sm text-muted-foreground">
                  {c.purchases} {c.purchases === 1 ? "purchase" : "purchases"}.
                  Last{" "}
                  {c.lastPurchaseAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone,
                  })}
                  .
                </span>
                <span className="text-sm font-semibold">
                  {promoStatus(c, timeZone)}
                </span>
                <RemoveCustomer id={c.id} name={c.name} />
              </li>
            ))}
          </ul>
        )}
        {rows.length === CUSTOMERS_SHOWN && (
          <p className="mt-2 text-sm text-muted-foreground">
            Showing the latest {CUSTOMERS_SHOWN}. Search to find anyone else.
          </p>
        )}
        <div className="mt-5 flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">
            {optedIn === 0
              ? "No one has opted in yet."
              : "Only buyers who ticked the box. Include the unsubscribe link in every email you send."}
          </p>
          <ExportButton
            href="/dashboard/customers/export"
            disabled={optedIn === 0}
          >
            Export promo list
          </ExportButton>
        </div>
      </section>
    </>
  );
}
