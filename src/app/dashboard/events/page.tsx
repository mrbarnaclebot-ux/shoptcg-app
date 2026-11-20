import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TicketLoading } from "@/components/ticket";
import { TicketButton } from "@/components/ticket-button";
import { getDb } from "@/db";
import { listEvents } from "@/lib/claim-events";
import { requireStore, sellerTimeZone } from "@/lib/session";
import { BackToMore } from "../back-to-more";
import { eventTime } from "./format";
import { StatusStamp } from "./status";

export const metadata: Metadata = { title: "Claim events" };

export default function EventsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start gap-4 px-4 pt-4 pb-16 lg:max-w-[1280px] lg:px-8">
      <BackToMore />
      <h1 className="font-display text-4xl font-black">Claim events</h1>
      <p className="max-w-2xl text-muted-foreground">
        A timed sale on its own page. Buyers join with their name, WhatsApp and
        email, then claim with one tap. It ends at the time you set or when
        everything is claimed.
      </p>
      <Suspense fallback={<TicketLoading>Finding your events</TicketLoading>}>
        <Events />
      </Suspense>
    </main>
  );
}

async function Events() {
  const { store } = await requireStore();
  if (store.sellingMode !== "online")
    return (
      <p className="paper p-4">
        Claim events are for online stores. Switch under{" "}
        <Link
          href="/dashboard/settings/table"
          className="font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
        >
          How you sell
        </Link>
        .
      </p>
    );
  const [events, timeZone] = await Promise.all([
    listEvents(getDb(), store.id),
    sellerTimeZone(),
  ]);
  const open = events.some((e) => e.status !== "ended");
  return (
    <>
      {open ? (
        <p className="text-sm text-muted-foreground">
          One event at a time. End the current one to start another.
        </p>
      ) : (
        <TicketButton href="/dashboard/events/new">New event</TicketButton>
      )}
      {events.length ? (
        <ul className="w-full lg:grid lg:grid-cols-2 lg:gap-x-10">
          {events.map((e) => (
            <li key={e.id} className="border-b border-border">
              <Link
                href={`/dashboard/events/${e.id}`}
                className="flex items-start justify-between gap-3 py-4"
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{e.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {eventTime(e.startsAt, timeZone)} to{" "}
                    {eventTime(e.endsAt, timeZone)}
                  </span>
                  <span className="num block text-sm text-muted-foreground">
                    {e.items} {e.items === 1 ? "item" : "items"}, {e.buyers}{" "}
                    {e.buyers === 1 ? "buyer" : "buyers"}
                  </span>
                </span>
                <StatusStamp status={e.status} className="mt-1 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 py-6 text-muted-foreground">
          <CalendarClock aria-hidden className="size-5" />
          No events yet.
        </p>
      )}
    </>
  );
}
