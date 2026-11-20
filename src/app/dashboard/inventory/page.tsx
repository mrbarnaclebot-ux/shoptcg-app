import { FileSpreadsheet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { lineButton, TicketButton } from "@/components/ticket-button";
import { shortDate, usd } from "@/lib/format";
import { getDb } from "@/db";
import { ExportButton } from "@/components/export-button";
import {
  countListings,
  countStock,
  listStock,
  PAGE_ROWS,
} from "@/lib/listings";
import { tableSale } from "@/lib/requests";
import { requireStore } from "@/lib/session";
import { awaitingPrice, vendorPrice } from "@/lib/vendor-price";
import { Bulk } from "./bulk";
import { filterSchema, Filters, href, type Filter } from "./filters";
import { StockRow } from "./stock-row";

export const metadata: Metadata = { title: "Inventory - tcgmart" };

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
  const [rows, selling, all, total] = await Promise.all([
    listStock(getDb(), store.id, filter),
    tableSale(getDb(), store.id),
    countListings(getDb(), store.id),
    countStock(getDb(), store.id, filter),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const filtered = Boolean(filter.q || filter.kind || filter.language);
  const rule = [store.priceRulePct, Number(store.rounding)] as const;
  const synced = rows.reduce<string | null>(
    (max, r) => (r.asOf && (!max || r.asOf > max) ? r.asOf : max),
    null,
  );
  return (
    <>
      <Header count={filtered ? null : total} synced={synced} />
      {/* Also with only hidden or removed stock, so those tabs stay reachable. */}
      {all || filtered ? <Filters filter={filter} /> : null}
      {selling && (
        <Link
          href={`/dashboard/requests/${selling.id}`}
          className="num sticky top-2 z-10 flex min-h-12 items-center justify-between gap-3 bg-text px-4 font-semibold text-bg"
        >
          <span>
            Table sale: {selling.items} {selling.items === 1 ? "item" : "items"}
            , {usd(selling.total)}
          </span>
          <span className="underline underline-offset-4">Finish sale</span>
        </Link>
      )}
      {rows.length ? (
        <>
          <Bulk
            rows={rows.map((r) => ({ id: r.id, name: r.name }))}
            view={
              filter.kind === "removed" || filter.kind === "hidden"
                ? filter.kind
                : "active"
            }
          >
            <ul aria-label="Your stock" className="-mx-4 bg-surface md:mx-0">
              {rows.map((r) => (
                <StockRow
                  key={r.id}
                  row={r}
                  price={vendorPrice(r.market, ...rule, r.overridePrice)}
                  awaiting={awaitingPrice(r)}
                  today={today}
                />
              ))}
            </ul>
          </Bulk>
          <Pages filter={filter} total={total} />
        </>
      ) : filtered || filter.page ? (
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
              {count.toLocaleString("en-US")} {count === 1 ? "item" : "items"}
            </small>
          )}
        </h1>
        <p className="text-sm text-muted-foreground">
          {props.synced
            ? `Market prices from ${shortDate(props.synced)}. Updated nightly.`
            : "Market prices update nightly."}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/buy" className={`${lineButton} px-3.5`}>
          Buy
        </Link>
        <ExportButton
          href="/dashboard/inventory/export"
          unit="item"
          className="px-3.5"
        >
          Export
        </ExportButton>
        <Link
          href="/dashboard/inventory/import"
          className={`${lineButton} px-3.5`}
        >
          <FileSpreadsheet aria-hidden className="size-5" />
          Import<span className="hidden sm:inline"> CSV</span>
        </Link>
        <TicketButton href="/dashboard/inventory/add">Add</TicketButton>
      </div>
    </div>
  );
}

/** Previous and Next past PAGE_ROWS, kept in the URL. */
function Pages({ filter, total }: { filter: Filter; total: number }) {
  const page = filter.page ?? 1;
  if (total <= PAGE_ROWS && page === 1) return null;
  const n = (v: number) => v.toLocaleString("en-US");
  const from = (page - 1) * PAGE_ROWS + 1;
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center gap-3">
      <p className="num mr-auto text-muted-foreground">
        {n(from)} to {n(Math.min(total, page * PAGE_ROWS))} of {n(total)}
      </p>
      {page > 1 && (
        <Link href={href(filter, { page: page - 1 })} className={lineButton}>
          Previous
        </Link>
      )}
      {page * PAGE_ROWS < total && (
        <Link href={href(filter, { page: page + 1 })} className={lineButton}>
          Next
        </Link>
      )}
    </nav>
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

// No grey boxes in the hall: one line of ticket text while the list loads.
function Skeleton() {
  return (
    <p role="status" className="py-10 font-semibold text-subtle">
      Counting stock...
    </p>
  );
}
