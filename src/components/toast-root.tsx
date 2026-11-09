"use client";

import { MotionConfig } from "motion/react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Toaster } from "sileo";
import { ALERT_REGION_ID, STATUS_REGION_ID, toast } from "@/lib/toast";
// Imported here, not globally: toasts only ship on login and the dashboard.
import "@/styles/toasts.css";

// Paper ticket stock (oklch 0.955 0.013 82); toasts.css also forces it in CSS.
const PAPER = "#f4efe7";

const PHONE = "(max-width: 767px)";

function usePhone() {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia(PHONE);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => matchMedia(PHONE).matches,
    () => false,
  );
}

// Offline shows one sticky toast that turns into "Online" when the network returns.
function useConnectionToasts() {
  useEffect(() => {
    let back: (() => void) | undefined;
    const off = () => (back ??= toast.offline());
    const on = () => {
      back?.();
      back = undefined;
    };
    addEventListener("offline", off);
    addEventListener("online", on);
    return () => {
      removeEventListener("offline", off);
      removeEventListener("online", on);
    };
  }, []);
}

// Escape clears timed toasts; Sileo has no keyboard dismiss of its own. Skipped
// when something else already took the key or focus is in a dialog or panel.
function useEscapeDismiss() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const el = document.activeElement;
      if (
        el?.closest("dialog, [role=dialog], [role=alertdialog], [data-panel]")
      )
        return;
      toast.dismissTransient();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
}

/** Motion respects reduced motion app-wide; one Toaster, bottom on phones, top-right above. */
export function ToastRoot({ children }: { children: ReactNode }) {
  const phone = usePhone();
  useConnectionToasts();
  useEscapeDismiss();
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster
        position={phone ? "bottom-center" : "top-right"}
        // Clears the 64px tab bar on phones and the 56-64px header above.
        offset={phone ? { bottom: 76 } : { top: 60, right: 8 }}
        // Roundness 0: tickets are cut square, and it turns off the gooey blur.
        options={{ fill: PAPER, roundness: 0 }}
      />
      <div id={STATUS_REGION_ID} role="status" className="sr-only" />
      <div id={ALERT_REGION_ID} role="alert" className="sr-only" />
    </MotionConfig>
  );
}
