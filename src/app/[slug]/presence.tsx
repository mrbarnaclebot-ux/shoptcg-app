"use client";

import { X } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { goneText } from "@/lib/toast";
import { deviceId, LIST_EVENT, listOn, writeList } from "./list-island";

const PING_MS = 30_000;
const SETTLE_MS = 800;

/**
 * Tells the vendor's dashboard this buyer is on the page and what is on their
 * unsent list: once on load, every 30 seconds in view, and shortly after the
 * list changes. Failures are ignored; the next ping carries the same facts.
 * The answer names anything on the list the vendor has since removed: it
 * leaves the cart, and a note says so.
 */
export function Presence() {
  const { slug } = useParams<{ slug: string }>();
  const [gone, setGone] = useState<string[]>([]);
  useEffect(() => {
    const device = deviceId(slug);
    const send = () => {
      if (document.visibilityState !== "visible") return;
      const lines = Object.entries(listOn(slug)).map(([id, l]) => ({
        id,
        qty: l.qty,
      }));
      fetch("/api/visit", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, device, lines }),
      })
        .then((res) => (res.status === 200 ? res.json() : null))
        .then((body: { removed: { id: string; name: string }[] } | null) => {
          if (!body?.removed.length) return;
          const left = { ...listOn(slug) };
          for (const r of body.removed) delete left[r.id];
          writeList(slug, left);
          setGone((had) => [...had, ...body.removed.map((r) => r.name)]);
        })
        .catch(() => {});
    };
    let settle: ReturnType<typeof setTimeout>;
    const soon = () => {
      clearTimeout(settle);
      settle = setTimeout(send, SETTLE_MS);
    };
    send();
    const every = setInterval(send, PING_MS);
    addEventListener(LIST_EVENT, soon);
    addEventListener("storage", soon);
    document.addEventListener("visibilitychange", soon);
    return () => {
      clearTimeout(settle);
      clearInterval(every);
      removeEventListener(LIST_EVENT, soon);
      removeEventListener("storage", soon);
      document.removeEventListener("visibilitychange", soon);
    };
  }, [slug]);
  if (!gone.length) return null;
  // The store and cart load no toasts, so the note is a slip of its own.
  return (
    <div className="fixed inset-x-3 top-3 z-30 mx-auto max-w-[560px] drop-shadow-[0_12px_24px_oklch(0_0_0/0.6)]">
      <div className="paper flex items-start justify-between gap-3 py-1 pl-4">
        <p role="alert" className="py-2.5 font-semibold">
          {goneText(gone)}
        </p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setGone([])}
          className="grid size-11 shrink-0 place-items-center"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  );
}
