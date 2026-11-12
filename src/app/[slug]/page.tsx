import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RefreshAt } from "@/components/refresh-at";
import { lineButton } from "@/components/ticket-button";
import { getDb } from "@/db";
import { modeCopy } from "@/lib/selling-mode";
import {
  listPublicStock,
  storeSummary,
  type PublicFilter,
  type PublicStore,
} from "@/lib/storefront";
import { Controls, SortMenu } from "./controls";
import { ListBar, RememberStore } from "./list-island";
import { filterHref, parseFilter } from "./params";
import { storeOr404 } from "./store-lookup";
import { NotVending, StoreHeader } from "./store-header";
import { Tile, TileSkeleton } from "./tile";

// The store lookup runs before any Suspense boundary so an unknown slug is a
// real 404 (streaming would have committed a 200). That blocks the shell on
// one indexed query, which this opts out of instant-navigation validation for.
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/[slug]">): Promise<Metadata> {
  const store = await storeOr404((await params).slug);
  const description = `Pokemon cards from ${store.name}: prices next to market, stock and price history.`;
  // The banner reads best in a link preview; the profile image is next best.
  const image = store.bannerUrl ?? store.avatarUrl;
  return {
    title: `${store.name} - tcgmart`,
    description,
    openGraph: {
      title: store.name,
      description,
      // Data URLs (local and e2e uploads) mean nothing to another site.
      ...(image?.startsWith("https://") && {
        images: [{ url: image, alt: store.name }],
      }),
    },
    // Nothing to index while not vending, and no stale prices in search results.
    ...(store.state === "off" && { robots: { index: false } }),
  };
}

export default async function StorePage({
  params,
  searchParams,
}: PageProps<"/[slug]">) {
  const store = await storeOr404((await params).slug);
  if (store.state === "off") return <NotVending store={store} />;
  const f = parseFilter(await searchParams);
  const summary = await storeSummary(getDb(), store.id);
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 md:px-6 lg:px-8">
      <StoreHeader store={store} {...summary} />
      {/* A closed page polls so a reopening shows within a minute; an open one waits for its timer. */}
      <RefreshAt
        inMs={store.changesInMs}
        everyMs={store.isOpen ? undefined : 60_000}
      />
      {!store.isOpen && (
        <p className="-mx-4 mb-3 bg-surface-2 px-4 py-3 text-sm md:mx-0">
          <span className="font-semibold">Browsing only.</span> {store.name}{" "}
          isn&apos;t taking requests right now
          {store.resumesInMin !== null
            ? `. Back in about ${store.resumesInMin} min.`
            : "."}
        </p>
      )}
      <Controls slug={store.slug} f={f} />
      <Suspense fallback={<GridSkeleton />}>
        <Grid store={store} f={f} />
      </Suspense>
      <footer className="mt-10 border-t border-border pt-4 pb-32 text-xs text-muted-foreground">
        Prices are this seller&apos;s asking prices. Market prices from public
        sales data, updated daily.{" "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>
      </footer>
      {store.isOpen && <ListBar slug={store.slug} />}
      <RememberStore slug={store.slug} href={filterHref(store.slug, f)} />
    </main>
  );
}

const GRID =
  "grid grid-cols-2 gap-x-3 gap-y-7 md:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] lg:gap-x-5";

function GridSkeleton() {
  return (
    <div className={`${GRID} mt-12`}>
      {Array.from({ length: 6 }, (_, i) => (
        <TileSkeleton key={i} />
      ))}
    </div>
  );
}

async function Grid({ store, f }: { store: PublicStore; f: PublicFilter }) {
  const items = await listPublicStock(getDb(), store, f);
  const filtered = Boolean(f.type || f.langs?.length || f.q);
  if (!items.length) return <Empty store={store} f={f} filtered={filtered} />;
  return (
    <section aria-label="Stock">
      <div className="flex items-center justify-between py-2 text-sm text-muted-foreground">
        <p>
          <span className="num font-semibold text-text">{items.length}</span>{" "}
          {items.length === 1 ? "item" : "items"}
        </p>
        <SortMenu slug={store.slug} f={f} />
      </div>
      <div className={GRID}>
        {items.map((it, i) => (
          <Tile
            key={it.id}
            it={it}
            slug={store.slug}
            currency={store.secondCurrency}
            canAdd={store.isOpen}
            askPrice={modeCopy(store.sellingMode).askPrice}
            // One row on desktop, two on phones: the art above the fold.
            eager={i < 4}
          />
        ))}
      </div>
      {store.secondCurrency && store.fxRate !== null && (
        <p className="mt-10 text-xs text-muted-foreground">
          {store.secondCurrency} shown at the seller&apos;s rate: 1 USD ={" "}
          {store.fxRate} {store.secondCurrency}.{" "}
          {modeCopy(store.sellingMode).payNote}
        </p>
      )}
    </section>
  );
}

function Empty(props: {
  store: PublicStore;
  f: PublicFilter;
  filtered: boolean;
}) {
  if (!props.filtered)
    return (
      <p className="py-16 text-lg">
        {modeCopy(props.store.sellingMode).noStock}
      </p>
    );
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <p className="text-lg font-semibold">
        {props.f.q
          ? `No matches for "${props.f.q}".`
          : "Nothing matches these filters."}
      </p>
      <p className="text-muted-foreground">
        Try the card number, or clear filters.
      </p>
      <Link
        href={filterHref(props.store.slug, { sort: props.f.sort })}
        className={lineButton}
      >
        Clear filters
      </Link>
    </div>
  );
}
