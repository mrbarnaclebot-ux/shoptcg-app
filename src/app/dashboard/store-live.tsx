"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { chime, soundOn } from "@/lib/chime";
import { toast } from "@/lib/toast";
import { useLive } from "@/lib/use-live";

// One store stream per tab, run by the dashboard layout, so a request chimes
// on whatever page the vendor is on. The queue's status line and the tab
// bar's count read it from here instead of opening streams of their own.
type Live = { up: boolean; waiting: number };
const START: Live = { up: true, waiting: 0 };
let live = START;
const subs = new Set<() => void>();
const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => void subs.delete(cb);
};

export const useStoreLive = () =>
  useSyncExternalStore(
    subscribe,
    () => live,
    () => START,
  );

const showQueue = () =>
  document
    .getElementById("requests-h")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });

/** Chime and toast on a new request, from any dashboard page. */
export function StoreLive({ waiting }: { waiting: number }) {
  const router = useRouter();
  const up = useLive("/api/live/store", (e) => {
    if (e.t === "cancelled") toast.requestCancelled();
  });
  // On the count, not the event, so one found by a re-read still chimes.
  const seen = useRef(waiting);
  useEffect(() => {
    if (waiting > seen.current) {
      if (soundOn()) chime();
      toast.newRequest(() =>
        location.pathname === "/dashboard"
          ? showQueue()
          : router.push("/dashboard"),
      );
    }
    seen.current = waiting;
  }, [waiting, router]);
  useEffect(() => {
    if (up === live.up && waiting === live.waiting) return;
    live = { up, waiting };
    subs.forEach((cb) => cb());
  }, [up, waiting]);
  return null;
}
