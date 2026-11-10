"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { deviceId, LIST_EVENT, listOn } from "./list-island";

const PING_MS = 30_000;
const SETTLE_MS = 800;

/**
 * Tells the vendor's dashboard this buyer is on the page and what is on their
 * unsent list: once on load, every 30 seconds in view, and shortly after the
 * list changes. Failures are ignored; the next ping carries the same facts.
 */
export function Presence() {
  const { slug } = useParams<{ slug: string }>();
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
      }).catch(() => {});
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
  return null;
}
