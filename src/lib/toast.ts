import type { ReactNode } from "react";

// The app's whole toast vocabulary (.planning/design/personality/PERSONALITY.md
// state map) in the .planning/design/SCREENS.md vendor voice: what happened, then what to do. Each toast is one
// row (icon, bold title inline with the sentence, optional button), drawn by
// components/toast-root.tsx and styles/toasts.css. Copy lives here, nowhere else.
// Toasts are for what happens off-screen or in a list; when the page itself
// shows the result (link sent, store created, item added, settings saved) it
// does not toast too.

export const ALERT_REGION_ID = "toast-alert";
export const STATUS_REGION_ID = "toast-status";

export type Tone = "ok" | "info" | "warn" | "bad" | "wait";
export type ToastButton = { title: string; onClick: () => void };
export type ToastItem = {
  id: string;
  tone: Tone;
  title: string;
  body?: ReactNode;
  button?: ToastButton;
  /** ms until it leaves; null stays until dismissed or replaced. */
  duration: number | null;
  leaving?: boolean;
};
type Input = Omit<ToastItem, "id" | "leaving">;

const MAX = 3;
const LEAVE_MS = 200;
const NONE: ToastItem[] = [];
let items = NONE;
const subs = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const toastStore = {
  subscribe(cb: () => void) {
    subs.add(cb);
    return () => void subs.delete(cb);
  },
  get: () => items,
  server: () => NONE,
};

function set(next: ToastItem[]) {
  items = next;
  subs.forEach((cb) => cb());
}

// Every toast is announced exactly once, here: errors assertively, the rest politely.
function announce(text: string, urgent = false) {
  const el = document.getElementById(
    urgent ? ALERT_REGION_ID : STATUS_REGION_ID,
  );
  if (!el) return;
  el.textContent = "";
  setTimeout(() => (el.textContent = text), 50);
}

function dismiss(id: string) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  if (!items.some((t) => t.id === id)) return;
  set(items.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
  setTimeout(() => set(items.filter((t) => t.id !== id)), LEAVE_MS);
}

/** Shows a toast, or replaces the one with `id` in place (loading to result). */
function put(t: Input, id: string = crypto.randomUUID()) {
  const item = { ...t, id };
  if (items.some((x) => x.id === id))
    set(items.map((x) => (x.id === id ? item : x)));
  else {
    set([...items, item]);
    // Oldest go first once more than MAX are up.
    items
      .filter((x) => !x.leaving)
      .slice(0, -MAX)
      .forEach((x) => dismiss(x.id));
  }
  clearTimeout(timers.get(id));
  if (t.duration !== null)
    timers.set(
      id,
      setTimeout(() => dismiss(id), t.duration),
    );
  return id;
}

// Escape dismisses only these; sticky errors and offline stay until resolved.
const transient = new Set<string>();
let recorded: string | undefined;

function show(
  tone: Tone,
  title: string,
  body: string,
  duration: number,
  button?: ToastItem["button"],
) {
  announce(`${title}. ${body}`);
  const id = put({ tone, title, body, duration, button });
  transient.add(id);
  return id;
}

// Errors stay until dismissed. A retry is a shortcut only: the same action is
// always on the page too.
function error(title: string, body: string, retry?: () => void) {
  announce(`${title}. ${body}`, true);
  return put({
    tone: "bad",
    title,
    body,
    duration: null,
    button: retry && { title: "Try again", onClick: retry },
  });
}

export type ImportSummary = {
  count: number;
  unpriced: number;
  rejected: number[];
};

function importResult(r: ImportSummary): Input {
  const parts = [];
  if (r.unpriced) parts.push(`${r.unpriced} need a price`);
  if (r.rejected.length) parts.push(`skipped rows ${r.rejected.join(", ")}`);
  const body = parts.length ? `${parts.join("; ")}.` : "All priced.";
  const title = `${r.count} added from your CSV`;
  announce(`${title}. ${body}`);
  return { tone: "ok", title, body, duration: parts.length ? 8000 : 5000 };
}

export const toast = {
  linkExpired: () =>
    error("Link expired", "Links work once, for 5 minutes. Send a fresh one."),
  sendFailed: (why: string) => error("Not sent", why),
  rateLimited: () =>
    show(
      "warn",
      "Too many tries",
      "Wait a few minutes, then send another link.",
      8000,
    ),

  slugTaken: (slug: string) =>
    error("Link taken", `"${slug}" is in use. Try "${slug}-cards".`),
  storeState: (state: "open" | "paused" | "off", minutes: number | null) => {
    if (state === "open")
      return show("ok", "You're open", "Buyers can send requests now.", 4000);
    if (state === "off")
      return show(
        "info",
        "Not vending",
        "Your page shows your name and table, no stock.",
        4000,
      );
    const back =
      minutes === null
        ? "until you reopen"
        : `for ${minutes === 60 ? "1 hour" : `${minutes} min`}`;
    return show(
      "info",
      "Paused",
      `Buyers can browse, not send, ${back}.`,
      4000,
    );
  },
  notSaved: (why: string) => error("Not saved", why),
  tableSaved: (label: string | null) => {
    const body = label
      ? `Table ${label} is on your sign and store page.`
      : "Your sign no longer shows a table number.";
    return show("ok", "Settings saved", body, 4000);
  },

  itemUpdated: (name: string, change: string) =>
    show("ok", "Updated", `${name}. ${change}`, 4000),
  itemHidden: (name: string) =>
    show(
      "info",
      "Hidden",
      `${name} is off your public table. Show it again from Edit.`,
      5000,
    ),
  qtyZero: (name: string, onHide: () => void) => {
    const body = `${name} is at 0 and shows as sold out.`;
    announce(`Sold out. ${body}`);
    const button = { title: "Hide item", onClick: onHide };
    const id = put({
      tone: "warn",
      title: "Sold out",
      body,
      button,
      duration: 8000,
    });
    transient.add(id);
    return id;
  },
  qtyFailed: (qty: number, retry?: () => void) =>
    error(
      "Not saved",
      `The count didn't reach the server, so it's back at ${qty}.`,
      retry,
    ),
  searchLimit: (perHour: number) =>
    show(
      "warn",
      "Search limit",
      `That's ${perHour} new lookups this hour. Cards already in the catalog still show up.`,
      8000,
    ),

  csvUnreadable: (why: string) => error("Can't read that CSV", why),
  /** One toast that turns from loading into the result; `run` rejects with a user-safe message. */
  importCsv: async (rows: number, run: Promise<ImportSummary>) => {
    const title = `Adding ${rows} from your CSV`;
    announce(title);
    const id = put({ tone: "wait", title, duration: null });
    try {
      const r = await run;
      put(importResult(r), id);
      return r;
    } catch (err) {
      const why = err instanceof Error ? err.message : "Nothing was imported.";
      dismiss(id);
      error("Nothing added", why);
      throw err;
    }
  },

  /** One sticky toast that turns into "Back online"; call the result when the network returns. */
  offline: () => {
    const body = "Changes can't save until you're back online.";
    announce(`No connection. ${body}`, true);
    const id = put({
      tone: "bad",
      title: "No connection",
      body,
      duration: null,
    });
    return () => {
      announce("Back online. Changes save again.");
      put(
        {
          tone: "ok",
          title: "Back online",
          body: "Changes save again.",
          duration: 4000,
        },
        id,
      );
    };
  },

  // Buyer: the page changes too; these name the change for anyone looking away.
  holdEnding: (soon: string) => show("warn", "3 minutes left", soon, 8000),
  holdOver: (sendAgain: () => void) =>
    show("warn", "Hold's over", "Those cards are back in the store.", 6000, {
      title: "Send again",
      onClick: sendAgain,
    }),
  requestDeclined: (back: () => void) =>
    show(
      "info",
      "Not this time",
      "Ask the seller, or pick something else.",
      8000,
      { title: "Back to store", onClick: back },
    ),

  // Seller.
  newRequest: (review: () => void) =>
    show("ok", "New request", "A buyer just sent a cart.", 10000, {
      title: "Review",
      onClick: review,
    }),
  holdLapsed: () =>
    show("info", "Hold ended", "Those items are back in stock.", 6000),
  requestCancelled: () =>
    show("info", "Request cancelled", "Those items are back in stock.", 6000),
  /** A loading toast that saleRecorded turns into the result. */
  saleRecording: () => {
    announce("Recording sale");
    return put({ tone: "wait", title: "Recording", duration: null });
  },
  saleRecorded: (id: string, receiptNo: string, total: string) => {
    const title = `Sale ${receiptNo} recorded`;
    const body = `${total}. The receipt is on its way.`;
    announce(`${title}. ${body}`);
    put({ tone: "ok", title, body, duration: 6000 }, id);
    recorded = id;
  },
  /** The receipt loaded and says it all; the toast only held the line on slow WiFi. */
  receiptOpened: () => {
    if (recorded) dismiss(recorded);
    recorded = undefined;
  },
  saleFailed: () =>
    error("Sale not confirmed", "Tap Confirm again. It won't record twice."),
  exported: (file: string, rows: number, unit: string) =>
    show(
      "ok",
      "Exported",
      `${file}, ${rows} ${unit}${rows === 1 ? "" : "s"}.`,
      4000,
    ),
  customerRemoved: (name: string) =>
    show("ok", "Customer removed", `${name} is off your list.`, 4000),
  exportFailed: (retry: () => void) =>
    error("Export failed", "Nothing was lost. Try again.", retry),
  exportLimited: () => error("Too many exports", "Try again in a few minutes."),
  receiptSent: (email: string) =>
    show("ok", "Receipt sent", `Sent to ${email}.`, 4000),
  receiptFailed: (retry?: () => void) =>
    error(
      "Email didn't send",
      "The sale is saved. Try the email again.",
      retry,
    ),
  /** Sticky until the stream is back; returns the toast id to dismiss. */
  liveDropped: (check: () => void) => {
    const body = "New requests may be late.";
    announce(`Lost the live line. ${body}`, true);
    return put({
      tone: "warn",
      title: "Lost the live line",
      body,
      duration: null,
      button: { title: "Check for requests", onClick: check },
    });
  },

  dismiss,
  /** Escape: clear timed toasts, never sticky errors or offline. */
  dismissTransient: () => {
    transient.forEach(dismiss);
    transient.clear();
  },
};
