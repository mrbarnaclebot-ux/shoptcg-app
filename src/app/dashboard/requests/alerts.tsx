"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { TicketButton } from "@/components/ticket-button";
import {
  chime,
  onSoundChange,
  setSoundOn,
  soundOn,
  unlockAudio,
} from "@/lib/chime";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "../push-actions";

const swReady = () => navigator.serviceWorker.ready;

function base64urlBytes(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// ponytail: one switch for sound and push; split them if vendors want silent push.
async function subscribePush(publicKey: string) {
  if ((await Notification.requestPermission()) !== "granted") return;
  const sw = await swReady();
  const sub = await sw.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64urlBytes(publicKey),
  });
  await savePushSubscription(sub.toJSON());
}

async function unsubscribePush() {
  const sub = await (await swReady()).pushManager.getSubscription();
  if (!sub) return;
  await removePushSubscription(sub.endpoint);
  await sub.unsubscribe();
}

/** "Sound on" and "Test alert". Push is off, silently, without VAPID keys. */
export function AlertsRow({ publicKey }: { publicKey: string | null }) {
  const on = useSyncExternalStore(onSoundChange, soundOn, () => false);
  useEffect(() => {
    if (publicKey && "serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, [publicKey]);
  useEffect(() => {
    if (!on) return;
    addEventListener("pointerdown", unlockAudio, { once: true });
    return () => removeEventListener("pointerdown", unlockAudio);
  }, [on]);
  const toggle = () => {
    setSoundOn(!on);
    if (!on) chime();
    if (publicKey && "serviceWorker" in navigator && "PushManager" in window)
      (on ? unsubscribePush() : subscribePush(publicKey)).catch((err) =>
        console.error("[push] subscribe failed", err),
      );
  };
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <label className="flex min-h-11 items-center gap-2 font-semibold">
        <input
          type="checkbox"
          checked={on}
          onChange={toggle}
          className="size-6 accent-brand"
        />
        Sound on
      </label>
      <button
        type="button"
        onClick={() => {
          chime();
          sendTestPush().catch(() => {});
        }}
        className="min-h-11 font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
      >
        Test alert
      </button>
    </div>
  );
}

const NUDGE_KEY = "shoptcg:nudge";
const DAY_MS = 86_400_000;
const noop = () => () => {};

function nudgeDue() {
  if (matchMedia("(display-mode: standalone)").matches) return false;
  if (!matchMedia("(pointer: coarse)").matches) return false;
  try {
    return Date.now() - Number(localStorage.getItem(NUDGE_KEY)) > DAY_MS;
  } catch {
    return false;
  }
}

/** Phones only, once a day, until installed: iOS push needs the home screen. */
export function InstallNudge() {
  const due = useSyncExternalStore(noop, nudgeDue, () => false);
  const [gone, setGone] = useState(false);
  const [guide, setGuide] = useState(false);
  if (!due || gone) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 text-sm">
      <p>
        Get request alerts when your phone is locked. Add shoptcg to your home
        screen.
      </p>
      {guide && (
        <ol className="list-decimal pl-5">
          <li>Tap Share in your browser.</li>
          <li>Tap Add to Home Screen.</li>
          <li>Open shoptcg from your home screen.</li>
        </ol>
      )}
      <div className="flex flex-wrap gap-3">
        {!guide && (
          <TicketButton variant="secondary" onClick={() => setGuide(true)}>
            Show me how
          </TicketButton>
        )}
        <TicketButton
          variant="secondary"
          onClick={() => {
            try {
              localStorage.setItem(NUDGE_KEY, String(Date.now()));
            } catch {
              // Private mode: it comes back tomorrow regardless.
            }
            setGone(true);
          }}
        >
          Not now
        </TicketButton>
      </div>
    </div>
  );
}
