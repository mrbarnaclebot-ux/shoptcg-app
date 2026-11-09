"use client";

import { signOutAction } from "../actions";
import { removePushSubscription } from "../push-actions";

const GIVE_UP_MS = 2000;

/** This device stops getting the seller's alerts; other devices keep theirs. */
async function dropPush() {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub)
    await Promise.allSettled([
      removePushSubscription(sub.endpoint),
      sub.unsubscribe(),
    ]);
}

export function SignOut({ className }: { className: string }) {
  return (
    <form
      action={async () => {
        // Signing out must work on bad WiFi, push or no push.
        await Promise.race([
          dropPush().catch(() => {}),
          new Promise((done) => setTimeout(done, GIVE_UP_MS)),
        ]);
        await signOutAction();
      }}
      className="border-t border-border pt-6"
    >
      <button type="submit" className={className}>
        Sign out
      </button>
    </form>
  );
}
