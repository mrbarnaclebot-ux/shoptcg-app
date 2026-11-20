import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getDb } from "@/db";
import { readBuyerSid } from "@/lib/buyer-session";
import { publicEvent, roomState } from "@/lib/claim-events";
import { UUID } from "@/lib/storefront";
import { turnstileSiteKey } from "@/lib/turnstile";
import { storeOr404 } from "../../store-lookup";
import { StoreHeader } from "../../store-header";
import { ClaimRoom } from "./claim-room";

// As on the store page: the lookups run before any boundary so a bad id is a real 404.
export const instant = false;

async function eventOr404(slug: string, id: string) {
  const store = await storeOr404(slug);
  const e = UUID.test(id) ? await publicEvent(getDb(), id, slug) : null;
  if (!e) notFound();
  return { store, e };
}

export async function generateMetadata({
  params,
}: PageProps<"/[slug]/claim/[id]">): Promise<Metadata> {
  const { slug, id } = await params;
  const { store, e } = await eventOr404(slug, id);
  return {
    title: `${e.title} - ${store.name} - tcgmart`,
    description: `A claim sale from ${store.name}. Claim cards and sealed product before they go.`,
    robots: { index: false },
  };
}

export default async function ClaimPage({
  params,
}: PageProps<"/[slug]/claim/[id]">) {
  const { slug, id } = await params;
  const { store, e } = await eventOr404(slug, id);
  const room = await roomState(getDb(), e, await readBuyerSid());
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 md:px-6 lg:px-8">
      <StoreHeader store={store} />
      <Link
        href={`/${store.slug}`}
        className="mt-2 inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-muted-foreground hover:text-text"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {store.name}
      </Link>
      <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Claim event
      </p>
      <h1 className="font-display text-[2.75rem] leading-[0.9] font-black text-balance md:text-[3.5rem]">
        {e.title}
      </h1>
      <ClaimRoom
        slug={store.slug}
        id={e.id}
        initial={room}
        siteKey={turnstileSiteKey()}
        storeName={store.name}
        currency={store.secondCurrency}
        fxRate={store.fxRate}
        rules={{
          maxPerBuyer: e.maxPerBuyer,
          allowUnclaim: e.allowUnclaim,
          payWithinHours: e.payWithinHours,
          startsAt: e.startsAt.toISOString(),
          endsAt: e.endsAt.toISOString(),
        }}
      />
      <footer className="mt-10 border-t border-border pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))] text-xs text-muted-foreground">
        A claim holds the item for you. The seller messages you on WhatsApp to
        arrange payment.{" "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>
      </footer>
    </main>
  );
}
