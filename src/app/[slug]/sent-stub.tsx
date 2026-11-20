"use client";

import { cn } from "cn";
import Link from "next/link";
import { useEffect, useState } from "react";
import { stillWaiting } from "./cart/actions";

// Sending empties the cart, but a hold lasts up to a day online. The last
// request sent from this phone is kept per store, so the store and cart can
// link back to its waiting screen while the server says it still waits.

type Sent = { id: string; code: string };
const key = (slug: string) => `sent:${slug}`;

export function parseSent(raw: string | null): Sent | null {
  try {
    const s = JSON.parse(raw ?? "") as Partial<Sent> | null;
    return typeof s?.id === "string" && typeof s.code === "string"
      ? { id: s.id, code: s.code }
      : null;
  } catch {
    return null;
  }
}

const read = (slug: string) => {
  try {
    return parseSent(localStorage.getItem(key(slug)));
  } catch {
    return null;
  }
};

export function rememberSent(slug: string, sent: Sent) {
  try {
    localStorage.setItem(key(slug), JSON.stringify(sent));
  } catch {}
}

/** Once that request stops waiting; a newer one sent since stays. */
export function forgetSent(slug: string, id: string) {
  try {
    if (read(slug)?.id === id) localStorage.removeItem(key(slug));
  } catch {}
}

/** "Request 9GGT waiting · View", shown only once the server says it still is. */
export function SentStub(props: {
  slug: string;
  /** "Request" or "Order". */
  word: string;
  className?: string;
}) {
  const { slug } = props;
  const [sent, setSent] = useState<Sent | null>(null);
  useEffect(() => {
    const had = read(slug);
    if (!had) return;
    // Offline: say nothing and keep it for the next load.
    stillWaiting(had.id).then(
      (waiting) => (waiting ? setSent(had) : forgetSent(slug, had.id)),
      () => {},
    );
  }, [slug]);
  if (!sent) return null;
  return (
    <Link
      href={`/${slug}/request/${sent.id}`}
      className={cn(
        "paper flex min-h-12 items-center justify-between gap-3 px-4 py-2.5",
        props.className,
      )}
    >
      <span>
        {props.word}{" "}
        <span className="font-display num text-[1.375rem] leading-none font-extrabold">
          {sent.code}
        </span>{" "}
        waiting
      </span>
      <span className="shrink-0 font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]">
        View
      </span>
    </Link>
  );
}
