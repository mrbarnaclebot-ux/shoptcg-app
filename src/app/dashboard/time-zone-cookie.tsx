"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Tells the server the seller's zone, so "today" is their day and a move follows them. */
export function TimeZoneCookie() {
  const router = useRouter();
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tz = `tz=${encodeURIComponent(zone)}`;
    const changed = !document.cookie.split("; ").includes(tz);
    document.cookie = `${tz}; path=/; max-age=31536000; samesite=lax`;
    // This render used the old zone. Runs once a mount, so it can't loop.
    if (changed) router.refresh();
  }, [router]);
  return null;
}
