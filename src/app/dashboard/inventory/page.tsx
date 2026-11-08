import { FileSpreadsheet, LayoutGrid, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
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
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-4 px-4 pt-6 pb-16 md:px-6 lg:px-8">
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
        <ul className="flex flex-col gap-2">
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
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-2">
        <p className="eyebrow self-start">
          <span aria-hidden className="live-dot" />
          {props.synced
            ? `Market data ${shortDate(props.synced)}, sync nightly`
            : "Market sync nightly"}
        </p>
        <h1 className="text-3xl font-extrabold wdth-125">
          Inventory{" "}
          {count !== null && (
            <small className="num text-base font-semibold text-muted-foreground wdth-100">
              {count} {count === 1 ? "item" : "items"}
            </small>
          )}
        </h1>
      </div>
      <div className="flex gap-2">
        <Link
          href="/dashboard/inventory/import"
          aria-label="Import CSV"
          className={buttonVariants({
            variant: "secondary",
            size: "lg",
            className: "px-3",
          })}
        >
          <FileSpreadsheet aria-hidden className="size-5" />
          <span className="hidden sm:inline">Import CSV</span>
        </Link>
        <Link
          href="/dashboard/inventory/add"
          className={buttonVariants({ size: "lg", className: "px-4" })}
        >
          <Plus aria-hidden className="size-5" />
          Add
        </Link>
      </div>
    </div>
  );
}

function EmptyShelf() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-border-strong px-5 py-12 text-center">
      <LayoutGrid aria-hidden className="size-8 stroke-[1.75] text-subtle" />
      <h2 className="text-xl font-extrabold wdth-118">
        <span className="num">0</span> items logged.
      </h2>
      <p className="max-w-[36ch] text-muted-foreground">
        Search by name or number, or import a CSV.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard/inventory/add"
          className={buttonVariants({ size: "lg" })}
        >
          Add a card
        </Link>
        <Link
          href="/dashboard/inventory/import"
          className={buttonVariants({ variant: "secondary", size: "lg" })}
        >
          Import CSV
        </Link>
      </div>
      <a
        href="/inventory-template.csv"
        download
        className="inline-flex min-h-11 items-center text-brand-text underline underline-offset-4"
      >
        Download the CSV template
      </a>
    </section>
  );
}

function NoMatches() {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="text-lg font-semibold">Nothing matches.</p>
      <Link
        href="/dashboard/inventory"
        className="inline-flex min-h-11 items-center text-brand-text underline underline-offset-4"
      >
        Clear filters
      </Link>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="h-12 animate-pulse rounded-sm bg-surface" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-sm bg-surface" />
      ))}
    </div>
  );
}
