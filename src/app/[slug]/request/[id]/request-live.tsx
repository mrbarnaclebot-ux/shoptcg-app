"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { TicketButton } from "@/components/ticket-button";
import type { RequestStatus } from "@/db/schema";
import type { Line } from "@/lib/request-reads";
import { toast } from "@/lib/toast";
import { clock, useLive, useNow } from "@/lib/use-live";
import { writeList } from "../../list-island";
import { cancelMyRequest } from "../../list/actions";

const WARN_MS = 3 * 60_000;

/** Puts what was on the request back on the list; the review clamps it to what's left. */
function useSendAgain(slug: string, lines: Line[]) {
  const router = useRouter();
  return () => {
    writeList(
      slug,
      Object.fromEntries(
        lines.map((l) => [l.listingId, { qty: l.qty, price: l.price }]),
      ),
    );
    router.push(`/${slug}/list`);
  };
}

/** Keeps the waiting screen current and names a change that lands while it is open. */
export function RequestLive(props: {
  id: string;
  slug: string;
  status: RequestStatus;
  lines: Line[];
}) {
  const { status, slug } = props;
  const router = useRouter();
  const sendAgain = useSendAgain(slug, props.lines);
  useLive(status === "pending" ? `/api/live/request/${props.id}` : null);
  const last = useRef(status);
  useEffect(() => {
    if (last.current === status) return;
    last.current = status;
    if (status === "expired") toast.holdOver(sendAgain);
    if (status === "declined")
      toast.requestDeclined(() => router.push(`/${slug}`));
  });
  return null;
}

export function HoldClock(props: { at: number; table: string | null }) {
  const router = useRouter();
  const now = useNow();
  const left = props.at - now;
  const warn = Boolean(now) && left < WARN_MS;
  const over = Boolean(now) && left <= 0;
  const warned = useRef(false);
  useEffect(() => {
    if (warn && !over && !warned.current) {
      warned.current = true;
      toast.holdEnding(props.table);
    }
  }, [warn, over, props.table]);
  // Expiry is lazy on the server, so a re-read at zero shows it.
  useEffect(() => {
    if (over) router.refresh();
  }, [over, router]);
  return (
    <div>
      <p className="font-display num text-[3rem] leading-none font-extrabold text-brand-text">
        Held for {clock(props.at, now)}
      </p>
      {warn && (
        <p className="mt-1 font-semibold">
          Hold ends soon.
          {props.table && ` Find the seller at table ${props.table}.`}
        </p>
      )}
    </div>
  );
}

export function CancelRequest({ id }: { id: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  if (!asking)
    return (
      <TicketButton variant="secondary" onClick={() => setAsking(true)}>
        Cancel request
      </TicketButton>
    );
  const cancel = () =>
    start(async () => {
      const done = await cancelMyRequest(id).catch(() => false);
      if (!done) setAsking(false);
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">Cancel and release your items?</p>
      <div className="flex flex-wrap gap-3">
        <TicketButton variant="secondary" disabled={pending} onClick={cancel}>
          Yes, cancel
        </TicketButton>
        <TicketButton variant="secondary" onClick={() => setAsking(false)}>
          Keep
        </TicketButton>
      </div>
    </div>
  );
}

export function SendAgain(props: { slug: string; lines: Line[] }) {
  const sendAgain = useSendAgain(props.slug, props.lines);
  return <TicketButton onClick={sendAgain}>Send again</TicketButton>;
}
