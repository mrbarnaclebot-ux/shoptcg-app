"use client";

import { useEffect, useRef } from "react";
import { signOutAction } from "../actions";

// A server-action form, so a tap before hydration still signs out. One round
// trip: the server drops this device's push row, then the session.
export function SignOut({ className }: { className: string }) {
  const endpoint = useRef<HTMLInputElement>(null);
  const sub = useRef<PushSubscription | null>(null);
  useEffect(() => {
    navigator.serviceWorker
      ?.getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((s) => {
        sub.current = s ?? null;
        if (s && endpoint.current) endpoint.current.value = s.endpoint;
      })
      .catch(() => {});
  }, []);
  return (
    <form
      action={signOutAction}
      // Not awaited: signing out must work on bad WiFi, push or no push.
      onSubmit={() => void sub.current?.unsubscribe().catch(() => {})}
      className="border-t border-border pt-6"
    >
      <input ref={endpoint} type="hidden" name="endpoint" defaultValue="" />
      <button type="submit" className={className}>
        Sign out
      </button>
    </form>
  );
}
