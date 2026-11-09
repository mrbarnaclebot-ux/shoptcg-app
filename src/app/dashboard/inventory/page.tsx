import { FileSpreadsheet, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { lineButton, TicketButton } from "@/components/ticket-button";
import { shortDate } from "@/lib/format";
import { getDb } from "@/db";
import { listStock } from "@/lib/listings";
import { requireStore } from "@/lib/session";
import { vendorPrice } from "@/lib/vendor-price";
import { filterSchema, Filters } from "./filters";
import { StockRow } from "./stock-row";

export const metadata: Metadata = { title: "Inventory - shoptcg" };

export default function InventoryPage({
  searchParams,
}: PageProps<"/dashboard/inventory">) {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-4 pt-8 pb-16 md:px-6 lg:px-8">
      <Suspense fallback={<Skeleton />}>
        <Inventory searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Inventory({
  searchParams,
}: Pick<PageProps<"/dashboard/inventory">, "searchParams">) {
  const { store } = await requireStore();
  const filter = filterSchema.parse(await searchParams);
  const rows = await listStock(getDb(), store.id, filter);
  const today = new Date().toISOString().slice(0, 10);
  const filtered = Boolean(filter.q || filter.kind || filter.language);
  const rule = [store.priceRulePct, Number(store.rounding)] as const;
  const synced = rows.reduce<string | null>(
    (max, r) => (r.asOf && (!max || r.asOf > max) ? r.asOf : max),
    null,
  );
  return (
    <>
      <Header count={filtered ? null : rows.length} synced={synced} />
      {rows.length || filtered ? <Filters filter={filter} /> : null}
      {rows.length ? (
        <ul className="-mx-4 bg-surface md:mx-0">
          {rows.map((r) => (
            <StockRow
              key={r.id}
              row={r}
              price={vendorPrice(r.market, ...rule, r.overridePrice)}
              today={today}
            />
          ))}
        </ul>
      ) : filtered ? (
        <NoMatches />
      ) : (
        <EmptyShelf />
      )}
    </>
  );
}

function Header(props: { count: number | null; synced: string | null }) {
  const { count } = props;
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-4">
      <div className="flex flex-col gap-2">
        <h1 className="font-display flex items-baseline gap-3 text-[3.5rem] leading-[0.82] font-black">
          Inventory
          {count !== null && (
            <small className="num font-sans text-base font-semibold text-muted-foreground">
              {count} {count === 1 ? "item" : "items"}
            </small>
          )}
        </h1>
        <p className="text-sm text-muted-foreground">
          {props.synced
            ? `Market prices from ${shortDate(props.synced)}. Updated nightly.`
            : "Market prices update nightly."}
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/dashboard/inventory/import"
          aria-label="Import CSV"
          className={`${lineButton} px-3.5`}
        >
          <FileSpreadsheet aria-hidden className="size-5" />
          <span className="hidden sm:inline">Import CSV</span>
        </Link>
        <TicketButton
          href="/dashboard/inventory/add"
          icon={<Plus className="size-[18px]" strokeWidth={2.4} />}
        >
          Add
        </TicketButton>
      </div>
    </div>
  );
}

function EmptyShelf() {
  return (
    <section className="flex flex-col items-start gap-3 border-t border-dashed border-border-strong pt-6">
      <h2 className="font-display text-[2.25rem] leading-none font-extrabold">
        Your shelf is empty.
      </h2>
      <p className="max-w-[44ch] text-muted-foreground">
        Add your first card by name or number, or import a CSV of your stock.
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        <TicketButton href="/dashboard/inventory/add">Add a card</TicketButton>
        <Link href="/dashboard/inventory/import" className={lineButton}>
          Import CSV
        </Link>
      </div>
      <a
        href="/inventory-template.csv"
        download
        className="inline-flex min-h-11 items-center underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
      >
        Download the CSV template
      </a>
    </section>
  );
}

function NoMatches() {
  return (
    <div className="flex flex-col items-start gap-2 py-10">
      <p className="font-display text-[2rem] leading-none font-extrabold">
        Nothing matches.
      </p>
      <p className="text-muted-foreground">
        Try the card number, or clear filters.
      </p>
      <Link
        href="/dashboard/inventory"
        className="inline-flex min-h-11 items-center underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
      >
        Clear filters
      </Link>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="h-12 animate-pulse bg-surface" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-24 animate-pulse bg-surface" />
      ))}
    </div>
  );
}
