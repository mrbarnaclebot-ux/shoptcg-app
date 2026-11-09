"use client";

import { MotionConfig } from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ALERT_REGION_ID,
  STATUS_REGION_ID,
  toast,
  toastStore,
  type Tone,
  type ToastItem,
} from "@/lib/toast";
// Imported here, not globally: toasts only ship on login and the dashboard.
import "@/styles/toasts.css";

// Offline shows one sticky toast that turns into "Back online" when the network returns.
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

// Escape clears timed toasts. Skipped when something else already took the
// key or focus is in a dialog or panel.
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

// The row the vendor last touched (a tap does not focus a button on iOS, so
// pointerdown is tracked too). A server refresh can swap the row's node before
// the toast arrives, so its rect at tap time is the fallback.
let touched: { el: Element; at: DOMRect } | null = null;
function useTouchedRow() {
  useEffect(() => {
    const mark = (e: Event) => {
      const el = (e.target as Element).closest?.("li, tr, form, section");
      touched = el ? { el, at: el.getBoundingClientRect() } : null;
    };
    addEventListener("pointerdown", mark, true);
    addEventListener("focusin", mark, true);
    return () => {
      removeEventListener("pointerdown", mark, true);
      removeEventListener("focusin", mark, true);
    };
  }, []);
}

const touchedRect = () =>
  touched &&
  (touched.el.isConnected ? touched.el.getBoundingClientRect() : touched.at);

const overlaps = (a: DOMRect, b: DOMRect) =>
  a.top < b.bottom && b.top < a.bottom && a.left < b.right && b.left < a.right;

// Top under the header on phones, bottom-right above (toasts.css). If that
// spot covers the touched row, the stack moves to the opposite edge.
// ponytail: a row taller than the gap between the edges is covered either way.
function useFlip(count: number) {
  const ref = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measured in the home spot; this runs before paint, so nothing jumps.
    el.removeAttribute("data-flip");
    const row = count ? touchedRect() : null;
    if (!row) return;
    const hit = overlaps(el.getBoundingClientRect(), row);
    el.toggleAttribute("data-flip", hit);
  }, [count]);
  return ref;
}

const PATH: Record<Tone, string> = {
  ok: "m5 12.5 4.5 4.5L19 7.5",
  info: "M12 11v6M12 7h.01",
  warn: "M12 7v6M12 17h.01",
  bad: "M12 7v6M12 17h.01",
  wait: "M12 3a9 9 0 1 0 9 9",
};

function Toast({ t }: { t: ToastItem }) {
  return (
    <li data-toast={t.tone} data-leaving={t.leaving || undefined}>
      <span className="toast-ic" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d={PATH[t.tone]} />
        </svg>
      </span>
      <p>
        <b>{t.title}.</b> {t.body}
      </p>
      {t.button ? (
        <button
          type="button"
          onClick={() => {
            toast.dismiss(t.id);
            t.button!.onClick();
          }}
        >
          {t.button.title}
        </button>
      ) : (
        <span />
      )}
    </li>
  );
}

/** Motion respects reduced motion app-wide; one toast stack, announced via the live regions below. */
export function ToastRoot({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(
    toastStore.subscribe,
    toastStore.get,
    toastStore.server,
  );
  const ref = useFlip(items.length);
  useConnectionToasts();
  useEscapeDismiss();
  useTouchedRow();
  return (
    <MotionConfig reducedMotion="user">
      {children}
      {/* Not a live region: the regions below announce each toast once. */}
      <ol ref={ref} className="toasts">
        {items.map((t) => (
          <Toast key={t.id} t={t} />
        ))}
      </ol>
      <div id={STATUS_REGION_ID} role="status" className="sr-only" />
      <div id={ALERT_REGION_ID} role="alert" className="sr-only" />
    </MotionConfig>
  );
}
