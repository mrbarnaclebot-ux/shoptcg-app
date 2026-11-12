"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const POLL_MS = 10_000;
const RETRY_MS = 5_000;
// Postgres drops notifications while LISTEN reconnects, and the stream can't
// tell, so an up stream still re-reads now and then.
const HEARTBEAT_MS = 60_000;

export type LiveMessage = { t: string; r?: string };

/**
 * Re-reads the page on every server-sent event, and polls while the stream is
 * down (venue WiFi). EventSource retries by itself except after an HTTP error,
 * so that case reconnects here. Returns whether the stream is up.
 */
export function useLive(
  url: string | null,
  onEvent?: (e: LiveMessage) => void,
) {
  const router = useRouter();
  const [up, setUp] = useState(true);
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });
  useEffect(() => {
    if (!url) return;
    let es: EventSource;
    let poll: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let down = false;
    const connect = () => {
      es = new EventSource(url);
      es.onopen = () => {
        clearInterval(poll);
        setUp(true);
        // Anything sent during the gap was missed.
        if (down) router.refresh();
        down = false;
      };
      es.onmessage = (m) => {
        router.refresh();
        handler.current?.(JSON.parse(m.data) as LiveMessage);
      };
      es.onerror = () => {
        down = true;
        setUp(false);
        clearInterval(poll);
        poll = setInterval(() => router.refresh(), POLL_MS);
        if (es.readyState === EventSource.CLOSED)
          retry = setTimeout(connect, RETRY_MS);
      };
    };
    connect();
    const heartbeat = setInterval(() => router.refresh(), HEARTBEAT_MS);
    return () => {
      es.close();
      clearInterval(heartbeat);
      clearInterval(poll);
      clearTimeout(retry);
    };
  }, [url, router]);
  return up;
}

const REFRESH_MS = 2000;
const MAX_REFRESHES = 10;

/** Re-reads the page while `active`, for 20 seconds; true once it has given up. */
export function useRefreshWhile(active: boolean) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!active) return;
    let n = 0;
    const t = setInterval(() => {
      if (++n <= MAX_REFRESHES) return router.refresh();
      clearInterval(t);
      setGaveUp(true);
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [active, router]);
  return gaveUp;
}

const tick = (cb: () => void) => {
  const t = setInterval(cb, 1000);
  return () => clearInterval(t);
};

/**
 * The clock, whole seconds; 0 until hydrated, so server and client agree.
 * ponytail: trusts the phone's clock; send a server offset if skew shows up.
 */
export const useNow = () =>
  useSyncExternalStore(
    tick,
    () => Math.floor(Date.now() / 1000) * 1000,
    () => 0,
  );

/** "14:32" until `at`, "--:--" before hydration. */
export function clock(at: number, now: number) {
  if (!now) return "--:--";
  const s = Math.max(0, Math.ceil((at - now) / 1000));
  const ss = String(s % 60).padStart(2, "0");
  // An online hold runs for hours: "23:59:59" rather than "1439:59".
  if (s >= 3600)
    return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${ss}`;
  return `${Math.floor(s / 60)}:${ss}`;
}
