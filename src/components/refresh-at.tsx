"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-reads the page when a store timer fires (inMs), and every everyMs while
 * set. Store state has no live stream for buyers; a closed page polls so a
 * vendor reopening shows up within a minute, an open one only waits for its timer.
 */
export function RefreshAt(props: { inMs: number | null; everyMs?: number }) {
  const router = useRouter();
  const { inMs, everyMs } = props;
  useEffect(() => {
    // A second of slack so the database clock has passed the boundary too.
    const once =
      inMs !== null &&
      inMs < 2 ** 31 - 1000 &&
      setTimeout(() => router.refresh(), Math.max(inMs, 0) + 1000);
    const every = everyMs && setInterval(() => router.refresh(), everyMs);
    return () => {
      if (once) clearTimeout(once);
      if (every) clearInterval(every);
    };
  }, [inMs, everyMs, router]);
  return null;
}
