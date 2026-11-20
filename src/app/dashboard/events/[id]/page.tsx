import { ChevronLeft, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RefreshAt } from "@/components/refresh-at";
import { TicketLoading } from "@/components/ticket";
import { lineButton } from "@/components/ticket-button";
import { getDb } from "@/db";
import { eventForVendor } from "@/lib/claim-events";
import { appUrl } from "@/lib/deployed";
import { usd } from "@/lib/format";
import { requireStore, sellerTimeZone } from "@/lib/session";
import { UUID } from "@/lib/storefront";
import { CopyLink } from "../../copy-link";
import { eventTime } from "../format";
import { StatusStamp } from "../status";
import { BuyerActions, EndEvent } from "./controls";

export const metadata: Metadata = { title: "Claim event" };

export default function EventPage({
  params,
}: PageProps<"/dashboard/events/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pt-4 pb-16 lg:max-w-[1280px] lg:px-8">
      <Link
        href="/dashboard/events"
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-muted-foreground hover:text-text"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Claim events
      </Link>
      <Suspense fallback={<TicketLoading>Loading event</TicketLoading>}>
        <Event params={params} />
      </Suspense>
    </main>
  );
}

const wa = (phone: string, text: string) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

async function Event({
  params,
}: Pick<PageProps<"/dashboard/events/[id]">, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { store } = await requireStore();
  const [e, timeZone] = await Promise.all([
    eventForVendor(getDb(), store.id, id),
    sellerTimeZone(),
  ]);
  if (!e) notFound();
  const url = `${appUrl().origin}/${store.slug}/claim/${e.id}`;
  const share = `${e.title} at ${store.name}: claim here ${url}`;
  const open = e.status !== "ended";
  const claimed = e.items.reduce((n, i) => n + i.held, 0);
  const units = e.items.reduce((n, i) => n + i.qty, 0);
  return (
    <>
      {/* Re-read when it starts or its time runs out. Claims, releases and
          sales re-read it through the dashboard layout's stream. */}
      <RefreshAt
        inMs={e.status === "scheduled" ? e.msToStart : open ? e.msToEnd : null}
      />
      <div className="flex flex-col gap-1">
        <StatusStamp status={e.status} className="mb-2 self-start" />
        <h1 className="font-display text-[3rem] leading-[0.85] font-black text-balance">
          {e.title}
        </h1>
        <p className="text-muted-foreground">
          {eventTime(e.startsAt, timeZone)} to {eventTime(e.endsAt, timeZone)}
        </p>
        <p className="text-sm text-muted-foreground">
          Up to {e.maxPerBuyer} per buyer.{" "}
          {e.priceMode === "custom" ? "Your event prices." : "Store prices."}{" "}
          {e.allowUnclaim
            ? "Buyers can give claims back."
            : "Claims are final."}{" "}
          {e.payWithinHours} h to pay after the end.
        </p>
      </div>

      {open && (
        <section aria-label="Share" className="paper flex flex-col gap-3 p-4">
          <p className="num text-sm break-all">{url}</p>
          <div className="flex flex-wrap items-center gap-3">
            <CopyLink url={url} />
            <a
              href={`https://wa.me/?text=${encodeURIComponent(share)}`}
              target="_blank"
              rel="noreferrer"
              className={`${lineButton} min-h-11 text-sm`}
            >
              <MessageCircle aria-hidden className="size-4" />
              Share on WhatsApp
            </a>
            <EndEvent id={e.id} />
          </div>
        </section>
      )}

      <section aria-labelledby="claims-h" className="flex flex-col gap-3">
        <h2 id="claims-h" className="text-lg font-semibold">
          Claims{" "}
          <span className="num text-muted-foreground">
            {claimed} of {units} units, {e.claims.length}{" "}
            {e.claims.length === 1 ? "buyer" : "buyers"}
          </span>
        </h2>
        {!e.claims.length && (
          <p className="text-muted-foreground">
            {open
              ? "Claims show here as they come in."
              : "Nobody claimed anything."}
          </p>
        )}
        <ul className="grid gap-4 lg:grid-cols-2">
          {e.claims.map((c) => (
            <li key={c.id} className="paper flex flex-col gap-2 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold">{c.name ?? "Buyer"}</p>
                <p className="num font-semibold">{usd(c.total)}</p>
              </div>
              <p className="num text-sm text-muted-foreground">
                Code {c.code} · {c.email}
              </p>
              <ul className="text-sm">
                {c.lines.map((l) => (
                  <li key={l.listingId} className="num">
                    {l.qty} x {l.name} · {usd(l.price)}
                  </li>
                ))}
              </ul>
              {c.status === "confirmed" ? (
                <p className="font-semibold text-success">Paid</p>
              ) : c.status === "expired" ? (
                <p className="font-semibold text-muted-foreground">
                  Not paid in time. Back in stock.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {c.phone && (
                    <a
                      href={wa(
                        c.phone,
                        `Hi ${c.name ?? ""}, thanks for claiming in ${e.title} at ${store.name} (code ${c.code}). Your total is ${usd(c.total)}.`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
                    >
                      <MessageCircle aria-hidden className="size-4" />
                      WhatsApp +{c.phone}
                    </a>
                  )}
                  <Link
                    href={`/dashboard/requests/${c.id}`}
                    className={`${lineButton} min-h-11 text-sm`}
                  >
                    Mark as paid
                  </Link>
                  <BuyerActions requestId={c.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="items-h" className="flex flex-col gap-2">
        <h2 id="items-h" className="text-lg font-semibold">
          Items
        </h2>
        <ul>
          {e.items.map((i) => (
            <li
              key={i.id}
              className="flex justify-between gap-3 border-b border-border py-2"
            >
              <span>{i.name}</span>
              <span className="num shrink-0 text-sm text-muted-foreground">
                {i.held} held for buyers · {i.qty} in stock
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
