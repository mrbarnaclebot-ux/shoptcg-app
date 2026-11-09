"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { RequestLines } from "@/components/request-lines";
import { Stamp } from "@/components/stamp";
import { StubValue, Ticket } from "@/components/ticket";
import { lineButton, TicketButton } from "@/components/ticket-button";
import { chime, soundOn } from "@/lib/chime";
import type { Line } from "@/lib/request-reads";
import { toast } from "@/lib/toast";
import { clock, useLive, useNow } from "@/lib/use-live";
import { declineAction, sendTestRequest } from "./actions";

const WARN_MS = 3 * 60_000;
const NEW_MS = 60_000;
const DROP_GRACE_MS = 8_000;

function onlineSub(cb: () => void) {
  addEventListener("online", cb);
  addEventListener("offline", cb);
  return () => {
    removeEventListener("online", cb);
    removeEventListener("offline", cb);
  };
}

const showQueue = () =>
  document
    .getElementById("requests-h")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });

/** The queue's live line: chime and toast on arrival, status, and the pull fallback. */
export function QueueLive({ pending }: { pending: number }) {
  const router = useRouter();
  const up = useLive("/api/live/store", (e) => {
    if (e.t === "cancelled") toast.requestCancelled();
  });
  // On the count, not the event, so one found by a re-read still chimes.
  const seen = useRef(pending);
  useEffect(() => {
    if (pending > seen.current) {
      if (soundOn()) chime();
      toast.newRequest(showQueue);
    }
    seen.current = pending;
  }, [pending]);
  const online = useSyncExternalStore(
    onlineSub,
    () => navigator.onLine,
    () => true,
  );
  // A stream ending at its five minutes is back within seconds; only a real drop speaks.
  useEffect(() => {
    if (up) return;
    let id: string | undefined;
    const t = setTimeout(() => {
      id = toast.liveDropped(() => router.refresh());
    }, DROP_GRACE_MS);
    return () => {
      clearTimeout(t);
      if (id) toast.dismiss(id);
    };
  }, [up, router]);
  useEffect(() => {
    const before = document.title;
    if (pending) document.title = `(${pending}) Requests`;
    return () => {
      document.title = before;
    };
  }, [pending]);
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 text-sm">
      <p role="status" className="inline-flex items-center gap-2 font-semibold">
        <span
          aria-hidden
          className={`size-2 rounded-full ${up ? "bg-success" : "bg-brand"}`}
        />
        {up ? "Live" : online ? "Reconnecting" : "Offline"}
      </p>
      {!up && (
        <button
          type="button"
          className={lineButton}
          onClick={() => router.refresh()}
        >
          Check for requests
        </button>
      )}
    </div>
  );
}

function age(from: number, now: number) {
  const min = Math.floor((now - from) / 60_000);
  return !now || min < 1 ? "just now" : `${min} min ago`;
}

export type TicketView = {
  id: string;
  code: string;
  buyerName: string | null;
  isTest: boolean;
  createdAt: number;
  expiresAt: number;
  lines: Line[];
};

export function QueueTicket({ t }: { t: TicketView }) {
  const router = useRouter();
  const now = useNow();
  const left = t.expiresAt - now;
  const over = Boolean(now) && left <= 0;
  const isNew = Boolean(now) && now - t.createdAt < NEW_MS;
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  // Expiry is lazy on the server: a re-read at zero moves it to the expired group.
  const lapsed = useRef(false);
  useEffect(() => {
    if (!over || lapsed.current) return;
    lapsed.current = true;
    toast.holdLapsed();
    router.refresh();
  }, [over, router]);
  const decline = () =>
    start(async () => {
      const done = await declineAction(t.id).catch(() => false);
      if (!done) {
        toast.notSaved("That request is no longer open.");
        setAsking(false);
      }
      router.refresh();
    });
  return (
    <li className={isNew ? "request-new" : undefined}>
      <Ticket
        as="div"
        stub={
          <>
            <StubValue k="Code" v={t.code} />
            <StubValue
              k="Hold"
              v={clock(t.expiresAt, now)}
              hold={Boolean(now) && left < WARN_MS}
            />
          </>
        }
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-display text-[1.875rem] leading-none font-extrabold">
            {t.buyerName}
          </span>
          <span className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
            {t.isTest && <Stamp>Test</Stamp>}
            {isNew && <Stamp>New</Stamp>}
            {age(t.createdAt, now)}
          </span>
        </div>
        <RequestLines lines={t.lines} />
        <div className="mt-4 flex flex-col gap-3">
          {asking ? (
            <>
              <p className="font-semibold">Decline and release items?</p>
              <div className="flex flex-wrap gap-3">
                <TicketButton
                  variant="secondary"
                  disabled={pending}
                  onClick={decline}
                >
                  Decline
                </TicketButton>
                <TicketButton
                  variant="secondary"
                  onClick={() => setAsking(false)}
                >
                  Keep
                </TicketButton>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-3">
              <TicketButton variant="secondary" onClick={() => setAsking(true)}>
                Decline
              </TicketButton>
              {/* ponytail: the confirm-sale screen arrives with phase 6; until
                  then the button is visibly off rather than a link to a 404. */}
              <TicketButton disabled>Review sale</TicketButton>
            </div>
          )}
        </div>
      </Ticket>
    </li>
  );
}

export function SendTestRequest() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const send = () =>
    start(async () => {
      const res = await sendTestRequest().catch(() => null);
      if (!res) toast.notSaved("Couldn't reach the server. Try again.");
      else if ("empty" in res)
        toast.notSaved("Add stock with a price first, then try the test.");
      router.refresh();
    });
  return (
    <TicketButton variant="secondary" disabled={pending} onClick={send}>
      Send a test request
    </TicketButton>
  );
}
