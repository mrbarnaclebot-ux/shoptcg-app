import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Fragment, Suspense, type ReactNode } from "react";
import { HangTag } from "@/components/hang-tag";
import { RefreshAt } from "@/components/refresh-at";
import { Stamp } from "@/components/stamp";
import { getDb } from "@/db";
import { modeCopy } from "@/lib/selling-mode";
import { formatAlt, usdTag } from "@/lib/fx";
import { gradeLabel, shortDate, usd } from "@/lib/format";
import {
  getPublicItem,
  type PublicItem,
  type PublicStore,
} from "@/lib/storefront";
import { BackToStore, CartAction, ShareItem } from "../../list-island";
import { ArtZoom } from "./art-zoom";
import { filterHref, parseRange } from "../../params";
import { NotVending, SellerLine } from "../../store-header";
import { storeOr404 } from "../../store-lookup";
import { Art, HTML_LANG, metaLine, stockLine } from "../../tile";
import { CONDITION_NAME, CONDITION_NOTE } from "@/lib/condition";
import { PriceChart } from "./price-chart";
import { priceHistory, salesHistory } from "./price-history";

// src/proxy.ts makes a hidden or unknown item a real 404 before the first
// byte, so ../loading.tsx can stream the art box while the lookups run.
export const instant = false;

// Where the nightly sync's market price comes from, by kind.
const SOURCE = {
  raw: "TCGplayer",
  sealed: "TCGplayer",
  graded: "eBay and Fanatics",
  other: "public sales",
};

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
  if (store.state === "off")
    return { title: store.name, robots: { index: false } };
  const title = `${item.name} – ${store.name}`;
  const price = item.qty && item.price !== null ? `${usd(item.price)}. ` : "";
  const description = `${price}${metaLine(item)}. ${stockLine(item)}.`;
  // A shared link shows the card, else the store's banner. Data URLs (local
  // uploads) mean nothing to another site.
  const image = [item.imageUrl, store.bannerUrl, store.avatarUrl].find((u) =>
    u?.startsWith("https://"),
  );
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(image && { images: [{ url: image, alt: item.name }] }),
    },
  };
}

export default async function ItemPage({
  params,
  searchParams,
}: PageProps<"/[slug]/item/[id]">) {
  const { slug, id } = await params;
  const { store, item } = await itemOr404(slug, id);
  // A 200 that says why, not a 404: a saved item link should not read as "this
  // store is gone". No price, stock or history while not vending.
  if (store.state === "off") return <NotVending store={store} />;
  const days = parseRange(await searchParams);
  const art = (
    <Art
      it={item}
      eager
      sizes="(min-width:1024px) 420px, 80vw"
      dim={!item.qty}
    />
  );
  return (
    <main className="mx-auto grid w-full max-w-[1200px] flex-1 content-start gap-x-12 px-4 pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))] md:px-6 lg:grid-cols-[minmax(0,420px)_1fr] lg:px-8 lg:pt-8">
      {/* Re-reads when a timer flips the state; closed pages also poll. */}
      <RefreshAt
        inMs={store.changesInMs}
        everyMs={store.isOpen ? undefined : 60_000}
      />
      <BackToStore slug={slug} />
      <SellerLine store={store} />
      <div className="mx-auto mt-3 w-4/5 max-w-[420px] lg:sticky lg:top-8 lg:w-full lg:self-start">
        {item.imageUrl ? (
          <ArtZoom src={item.imageUrl} name={item.name} className="w-full">
            {art}
          </ArtZoom>
        ) : (
          art
        )}
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
              <Chart
                id={item.catalogItemId}
                days={days}
                price={item.price}
                pct={item.conditionPct}
                source={SOURCE[item.kind]}
              />
            </Suspense>
          ) : (
            <p className="text-muted-foreground">
              This seller added this item by hand, so there is no market
              history.
            </p>
          )}
          {item.kind === "raw" && item.conditionPct !== 100 && (
            <p className="text-sm text-muted-foreground">
              {CONDITION_NAME[item.condition ?? ""] ?? "This condition"} is
              priced at {item.conditionPct}% of the Near Mint market.
            </p>
          )}
        </section>
        {item.catalogItemId && item.kind !== "sealed" && (
          <Suspense fallback={null}>
            <Sales id={item.catalogItemId} item={item} />
          </Suspense>
        )}
      </div>
    </main>
  );
}

function Details({ item, store }: { item: PublicItem; store: PublicStore }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1
          lang={HTML_LANG[item.language]}
          className="font-display text-3xl font-black text-balance md:text-[3.25rem]"
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
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <span>
            Market{" "}
            <span className="num font-semibold text-text">
              {usdTag(item.market)}
            </span>
            {item.asOf && (
              <span className="text-sm">
                {" "}
                · {SOURCE[item.kind]}, {shortDate(item.asOf)}
              </span>
            )}
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
      {/* Right under the price on desktop; pinned to the bottom on a phone. */}
      <Action store={store} item={item} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 border-t border-border text-sm [&>dd]:border-b [&>dd]:border-border [&>dd]:py-2 [&>dt]:border-b [&>dt]:border-border [&>dt]:py-2 [&>dt]:text-muted-foreground">
        {facts(item, store.slug).map(([k, v]) => (
          <Fragment key={k}>
            <dt>{k}</dt>
            <dd className="num font-semibold">{v}</dd>
          </Fragment>
        ))}
      </dl>
      <ShareItem title={`${item.name} - ${store.name}`} />
    </div>
  );
}

const KIND = {
  raw: "Single card",
  graded: "Graded slab",
  sealed: "Sealed",
  other: "Other",
};
const LANGUAGE = { en: "English", ja: "Japanese", zh: "Chinese" };

/** The rows a collector checks before buying, only those this item has. */
function facts(it: PublicItem, slug: string): [string, ReactNode][] {
  const rows: [string, ReactNode][] = [
    ["Type", KIND[it.kind]],
    ["Grade", it.kind === "graded" ? gradeLabel(it) || null : null],
    [
      "Condition",
      it.kind === "raw" && it.condition && (
        <>
          {CONDITION_NAME[it.condition] ?? it.condition} ({it.condition})
          <span className="block font-normal text-muted-foreground">
            {CONDITION_NOTE[it.condition]}
          </span>
        </>
      ),
    ],
    // An other item's "set" is the vendor's category; it has no language.
    // The search matches every word in the set, so the link browses it.
    [
      it.kind === "other" ? "Category" : "Set",
      it.setName && (
        <Link
          href={filterHref(slug, { q: it.setName })}
          className="-my-3 inline-flex min-h-11 items-center underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
        >
          {it.setName}
        </Link>
      ),
    ],
    ["Number", it.number],
    ["Language", it.kind === "other" ? null : LANGUAGE[it.language]],
  ];
  return rows.filter((r) => Boolean(r[1]));
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
  pct: number;
  source: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const nm = await priceHistory(props.id, props.days, today);
  // A played card's market follows Near Mint at the store's share.
  const points =
    props.pct === 100
      ? nm
      : nm.map((p) => ({
          ...p,
          market: Math.round(p.market * props.pct) / 100,
        }));
  return (
    <PriceChart
      points={points}
      days={props.days}
      price={props.price}
      source={props.source}
    />
  );
}

/** Recent market sales: what copies of this card actually sold for. */
async function Sales({ id, item }: { id: string; item: PublicItem }) {
  const today = new Date().toISOString().slice(0, 10);
  const days = await salesHistory(id, today);
  if (!days.length) return null;
  const what =
    item.kind === "graded"
      ? `${gradeLabel(item)} copies on ${SOURCE.graded}. Price is the day's average sale.`
      : `Near Mint copies on ${SOURCE.raw}. Price is the day's market price.`;
  return (
    <section aria-labelledby="sales" className="flex flex-col gap-3">
      <h2 id="sales" className="text-lg font-semibold">
        Recent sales
      </h2>
      <p className="text-sm text-muted-foreground">{what}</p>
      <table className="num w-full max-w-md text-left">
        <thead className="text-sm text-muted-foreground">
          <tr>
            <th scope="col" className="py-1 font-semibold">
              Date
            </th>
            <th scope="col" className="py-1 text-right font-semibold">
              Sold
            </th>
            <th scope="col" className="py-1 text-right font-semibold">
              Price
            </th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date} className="border-t border-border">
              <td className="py-2">{saleDate(d.date)}</td>
              <td className="py-2 text-right">{d.sales}</td>
              <td className="py-2 text-right">{usd(d.market)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// A calendar day, not a moment: formatted in UTC so it never shifts a day.
const saleDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** The add (sticky at the bottom on a phone), or the reason there isn't one. */
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
      <p className="font-semibold">
        {modeCopy(store.sellingMode).askPriceLine}
      </p>
    );
  else
    body = (
      <CartAction
        slug={store.slug}
        id={item.id}
        name={item.name}
        price={item.price}
        available={item.available}
      />
    );
  return (
    <div
      data-bottom-bar="item"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:border-0 lg:bg-transparent lg:p-0"
    >
      <div className="mx-auto max-w-[560px] lg:mx-0 lg:max-w-sm">{body}</div>
    </div>
  );
}
