"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";

const KEY = "signed-in";
const EVENT = "signed-in-change";

function subscribe(onChange: () => void) {
  addEventListener(EVENT, onChange);
  addEventListener("storage", onChange);
  return () => {
    removeEventListener(EVENT, onChange);
    removeEventListener("storage", onChange);
  };
}

/**
 * "Dashboard" for a signed-in seller, "Seller sign in" for everyone else.
 * Asked in the browser so the public pages stay static. The last answer is
 * kept in localStorage so a returning seller sees the right word at once;
 * the session check then confirms or corrects it.
 */
export function SellerLink({ className }: { className?: string }) {
  const signedIn = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(KEY) === "1",
    () => false,
  );
  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/auth/get-session", { signal: ac.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { user?: unknown } | null) => {
        if (s?.user) localStorage.setItem(KEY, "1");
        else localStorage.removeItem(KEY);
        dispatchEvent(new Event(EVENT));
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);
  // Either way it opens /dashboard; signed out, the proxy sends it to /login.
  return (
    <Link href="/dashboard" className={className}>
      {signedIn ? "Dashboard" : "Seller sign in"}
    </Link>
  );
}
