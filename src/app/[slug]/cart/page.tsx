import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RefreshAt } from "@/components/refresh-at";
import { getDb } from "@/db";
import { fulfilOptions, payOptions, storeOffer } from "@/lib/checkout";
import { MAX_LINES } from "@/lib/requests";
import { getPublicItems } from "@/lib/storefront";
import { NotVending } from "../store-header";
import { storeOr404 } from "../store-lookup";
import { metaLine } from "../tile";
import { CartReview, type ReviewItem } from "./cart-review";

// The store lookup runs before any Suspense boundary so an unknown slug is a 404.
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/[slug]/cart">): Promise<Metadata> {
  const store = await storeOr404((await params).slug);
  return { title: `Your cart - ${store.name} - tcgmart` };
}

export default async function CartPage({
  params,
  searchParams,
}: PageProps<"/[slug]/cart">) {
  const store = await storeOr404((await params).slug);
  if (store.state === "off") return <NotVending store={store} />;
  const raw = (await searchParams).ids;
  const ids = String(Array.isArray(raw) ? raw[0] : (raw ?? ""))
    .split(",")
    .filter(Boolean);
  const items: ReviewItem[] = (await getPublicItems(getDb(), store, ids)).map(
    (it) => ({
      id: it.id,
      name: it.name,
      meta: metaLine(it),
      kind: it.kind,
      imageUrl: it.imageUrl,
      price: it.price,
      available: it.available,
    }),
  );
  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 pt-4 pb-16 md:pt-8">
      {/* Re-reads when a timer flips the state; closed pages also poll. */}
      <RefreshAt
        inMs={store.changesInMs}
        everyMs={store.isOpen ? undefined : 60_000}
      />
      <Link
        href={`/${store.slug}`}
        className="flex min-h-11 items-center gap-2 self-start font-semibold"
      >
        <ArrowLeft aria-hidden className="size-5" />
        Back to store
      </Link>
      <h1 className="font-display mt-4 mb-5 text-[3rem] leading-[0.85] font-black">
        Your cart
      </h1>
      <CartReview
        store={{
          slug: store.slug,
          name: store.name,
          isOpen: store.isOpen,
          currency: store.secondCurrency,
          fxRate: store.fxRate,
          mode: store.sellingMode,
          fulfils: fulfilOptions(storeOffer(store)),
          pays: payOptions(storeOffer(store)),
          checkoutNote:
            store.sellingMode === "online" ? store.checkoutNote : null,
        }}
        items={items}
        loaded={ids}
        maxLines={MAX_LINES}
      />
    </main>
  );
}
