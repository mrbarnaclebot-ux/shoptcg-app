import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { HangTag } from "@/components/hang-tag";
import { Stamp } from "@/components/stamp";
import { getDb } from "@/db";
import { formatAlt, usdTag } from "@/lib/fx";
import { usd } from "@/lib/format";
import {
  getPublicItem,
  type PublicItem,
  type PublicStore,
} from "@/lib/storefront";
import { AddButton } from "../../list-island";
import { parseRange } from "../../params";
import { storeOr404 } from "../../store-lookup";
import { Art, HTML_LANG, metaLine, stockLine } from "../../tile";
import { PriceChart } from "./price-chart";
import { priceHistory } from "./price-history";

// Lookups run before any Suspense boundary so a hidden or unknown item is a real 404.
export const instant = false;

const itemOr404 = cache(async (slug: string, id: string) => {
  const store = await storeOr404(slug);
  const item = await getPublicItem(getDb(), store, id);
  if (!item) notFound();
  return { store, item };
});

export async function generateMetadata({
  params,
}: PageProps<"/[slug]/item/[id]">): Promise<Metadata> {
  const { slug, id } = await params;
  const { store, item } = await itemOr404(slug, id);
  return { title: `${item.name} - ${store.name} - shoptcg` };
}

export default async function ItemPage({
  params,
  searchParams,
}: PageProps<"/[slug]/item/[id]">) {
  const { slug, id } = await params;
  const { store, item } = await itemOr404(slug, id);
  const days = parseRange(await searchParams);
  return (
    <main className="mx-auto grid w-full max-w-[1200px] flex-1 content-start gap-x-12 px-4 pt-4 pb-32 md:px-6 lg:grid-cols-[minmax(0,420px)_1fr] lg:px-8 lg:pt-8">
      <Link
        href={`/${slug}`}
        className="flex min-h-11 items-center gap-2 self-start font-semibold lg:col-span-2"
      >
        <ArrowLeft aria-hidden className="size-5" />
        Back to store
      </Link>
      <div className="mt-3 lg:sticky lg:top-8 lg:self-start">
        <Art
          it={item}
          eager
          sizes="(min-width:1024px) 420px, 80vw"
          className={`mx-auto w-4/5 lg:w-full ${item.qty ? "" : "opacity-60 grayscale-[0.8]"}`}
        />
      </div>
      <div className="mt-6 flex flex-col gap-6 lg:mt-3">
        <Details item={item} store={store} />
        <section aria-labelledby="history" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 id="history" className="text-lg font-semibold">
              Price history
            </h2>
            <RangeLinks base={`/${slug}/item/${id}`} days={days} />
          </div>
          {item.catalogItemId ? (
            <Suspense
              fallback={<div className="h-56 animate-pulse bg-surface" />}
            >
              <Chart id={item.catalogItemId} days={days} price={item.price} />
            </Suspense>
          ) : (
            <p className="text-muted-foreground">
              This seller added this item by hand, so there is no market
              history.
            </p>
          )}
        </section>
      </div>
      <Action store={store} item={item} />
    </main>
  );
}

function Details({ item, store }: { item: PublicItem; store: PublicStore }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1
          lang={HTML_LANG[item.language]}
          className="font-display text-[2.5rem] leading-[0.9] font-black text-balance md:text-[3.25rem]"
        >
          {item.name}
        </h1>
        <p className="num mt-2 text-muted-foreground">{metaLine(item)}</p>
      </div>
      {item.qty > 0 && item.price !== null && (
        <HangTag
          className="self-start"
          price={usdTag(item.price)}
          sub={
            store.secondCurrency && item.alt !== null
              ? `approx. ${formatAlt(store.secondCurrency, item.alt)}`
              : undefined
          }
        />
      )}
      {item.market !== null && (
        <p className="flex flex-wrap items-center gap-3 text-muted-foreground">
          <span>
            Market{" "}
            <span className="num font-semibold text-text">
              {usd(item.market)}
            </span>
          </span>
          {item.underPct !== null && item.qty > 0 && (
            <Stamp>{item.underPct}% under market</Stamp>
          )}
        </p>
      )}
      <p
        className={
          item.available === 1 ? "font-semibold" : "text-muted-foreground"
        }
      >
        {stockLine(item)}
      </p>
    </div>
  );
}

function RangeLinks({ base, days }: { base: string; days: number }) {
  return (
    <nav aria-label="Range" className="flex">
      {[30, 90].map((d) => (
        <Link
          key={d}
          href={d === 30 ? base : `${base}?range=90`}
          scroll={false}
          replace
          aria-current={d === days ? "true" : undefined}
          className="num grid h-11 min-w-14 place-items-center px-3 text-sm font-semibold text-muted-foreground shadow-[inset_0_0_0_1px_var(--border-strong)] aria-[current=true]:bg-text aria-[current=true]:text-bg"
        >
          {d} days
        </Link>
      ))}
    </nav>
  );
}

async function Chart(props: {
  id: string;
  days: number;
  price: number | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const points = await priceHistory(props.id, props.days, today);
  return <PriceChart points={points} days={props.days} price={props.price} />;
}

/** Sticky bottom action, or the reason there isn't one. */
function Action({ store, item }: { store: PublicStore; item: PublicItem }) {
  let body;
  if (!store.isOpen) body = <p className="font-semibold">Browsing only.</p>;
  else if (!item.qty) body = <p className="font-semibold">Sold out.</p>;
  else if (!item.available)
    body = (
      <p className="font-semibold">
        On hold for another buyer. Check back in about {item.holdMin ?? 1} min.
      </p>
    );
  else if (item.price === null)
    body = (
      <p className="font-semibold">Ask the seller for a price at the table.</p>
    );
  else
    body = (
      <AddButton
        slug={store.slug}
        id={item.id}
        name={item.name}
        price={item.price}
        big
      />
    );
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:col-start-2 lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0">
      <div className="mx-auto max-w-[560px] lg:mx-0 lg:max-w-sm">{body}</div>
    </div>
  );
}
