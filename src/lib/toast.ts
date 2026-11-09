import { createElement as h, Fragment, type ReactNode } from "react";
import { sileo, type SileoOptions } from "sileo";
import { certNo, usd } from "@/lib/format";

// The app's whole toast vocabulary (PERSONALITY.md state map) in the SCREENS.md
// vendor voice: what happened, then what to do. Toasts render as paper tickets
// (styles/toasts.css). Copy lives here, nowhere else.

export const ALERT_REGION_ID = "toast-alert";
export const STATUS_REGION_ID = "toast-status";

// Sileo's viewport is patched to aria-live off (patches/sileo@0.1.6.patch), so
// every toast is announced exactly once here: errors assertively, the rest politely.
function announce(text: string, urgent = false) {
  const el = document.getElementById(
    urgent ? ALERT_REGION_ID : STATUS_REGION_ID,
  );
  if (!el) return;
  el.textContent = "";
  setTimeout(() => (el.textContent = text), 50);
}

type Kind = "success" | "info" | "warning";
// Escape dismisses only these; sticky errors and offline stay until resolved.
const transient = new Set<string>();

function show(kind: Kind, say: string, opts: SileoOptions) {
  announce(say);
  const id = sileo[kind](opts);
  transient.add(id);
  return id;
}

// Sileo types title as string but renders it as a React child; the ticket
// stub number after the title needs its own span.
function head(title: string, no?: string) {
  if (!no) return title;
  return h(
    Fragment,
    null,
    title,
    h("span", { "data-no": "" }, `No. ${no}`),
  ) as unknown as string;
}

/** Receipt lines under a toast title: label left, value right. */
function lines(rows: [string, ReactNode][], lead?: string) {
  return h(
    Fragment,
    null,
    lead && h("b", null, lead),
    h(
      "dl",
      { "data-lines": "" },
      rows.flatMap(([k, v]) => [
        h("dt", { key: `${k}t` }, k),
        h("dd", { key: `${k}d` }, v),
      ]),
    ),
  );
}

// Errors stay until dismissed. A retry is a shortcut only: the same action is
// always on the page too.
function error(title: string, description: string, retry?: () => void) {
  announce(`${title}. ${description}`, true);
  return sileo.error({
    title,
    description,
    duration: null,
    button: retry && { title: "Try again", onClick: retry },
  });
}

export type LoggedItem = {
  id: string;
  name: string;
  qty: number;
  condition?: string | null;
  price?: number | null;
  first?: boolean;
};

export type ImportSummary = {
  count: number;
  unpriced: number;
  rejected: number[];
};

function importResult(r: ImportSummary): SileoOptions {
  const rows: [string, ReactNode][] = [["Added", r.count]];
  if (r.unpriced) rows.push(["Need a price", r.unpriced]);
  if (r.rejected.length) rows.push(["Skipped rows", r.rejected.join(", ")]);
  const review = r.unpriced > 0 || r.rejected.length > 0;
  announce(rows.map(([k, v]) => `${k} ${v}`).join(". "));
  return {
    title: `${r.count} added from your CSV`,
    description: lines(rows),
    duration: review ? 8000 : 5000,
  };
}

export const toast = {
  linkSent: (email: string) => {
    const description = `Check ${email}. It works once, for 5 minutes.`;
    return show("success", `Link sent. ${description}`, {
      title: "Link sent",
      description,
      duration: 6000,
    });
  },
  linkExpired: () =>
    error("Link expired", "Links work once, for 5 minutes. Send a fresh one."),
  sendFailed: (why: string) => error("Not sent", why),
  rateLimited: () => {
    const description = "Wait a few minutes, then send another link.";
    return show("warning", `Too many tries. ${description}`, {
      title: "Too many tries",
      description,
      duration: 8000,
    });
  },

  storeCreated: (slug: string) => {
    const description = `shoptcg.app/${slug} is live. Time to stock the table.`;
    return show("success", `You're open. ${description}`, {
      title: "You're open",
      description,
      duration: 6000,
    });
  },
  slugTaken: (slug: string) =>
    error("Link taken", `"${slug}" is in use. Try "${slug}-cards".`),

  settingsSaved: (pct: number, rounding: number) => {
    const description = `Prices follow market ${pct > 0 ? "+" : ""}${pct}%, ${rounding ? `rounded to ${usd(rounding)}` : "to the cent"}.`;
    return show("success", `Settings saved. ${description}`, {
      title: "Settings saved",
      description,
      duration: 4000,
    });
  },
  notSaved: (why: string) => error("Not saved", why),

  itemAdded: (item: LoggedItem) => {
    const price = item.price == null ? "Follows market" : usd(item.price);
    const what = `${item.name}${item.condition ? `, ${item.condition}` : ""}, ${price}`;
    if (item.first) {
      const description = `Buyers can see it now. ${what}.`;
      return show("success", `First card on the table. ${description}`, {
        title: "First card on the table",
        description,
        duration: 6000,
      });
    }
    const rows: [string, ReactNode][] = [
      ["Qty", item.qty],
      ["Your price", price],
    ];
    if (item.condition) rows.unshift(["Condition", item.condition]);
    return show("success", `Added. ${what}, qty ${item.qty}.`, {
      title: head("Added", certNo(item.id)),
      description: lines(rows, item.name),
      duration: 5000,
    });
  },
  itemUpdated: (id: string, name: string, change: string) =>
    show("success", `Updated. ${name}. ${change}`, {
      title: head("Updated", certNo(id)),
      description: `${name}. ${change}`,
      duration: 4000,
    }),
  itemHidden: (id: string, name: string) => {
    const description = `${name} is off your public table. Show it again from Edit.`;
    return show("info", `Hidden. ${description}`, {
      title: head("Hidden", certNo(id)),
      description,
      duration: 5000,
    });
  },
  qtyZero: (name: string, onHide: () => void) => {
    const description = `${name} is at 0 and shows as sold out.`;
    return show("warning", `Sold out. ${description}`, {
      title: "Sold out",
      description,
      button: { title: "Hide item", onClick: onHide },
      duration: 8000,
    });
  },
  qtyFailed: (qty: number, retry?: () => void) =>
    error(
      "Not saved",
      `The count didn't reach the server, so it's back at ${qty}.`,
      retry,
    ),
  searchLimit: (perHour: number) => {
    const description = `That's ${perHour} new lookups this hour. Cards already in the catalog still show up.`;
    return show("warning", `Search limit. ${description}`, {
      title: "Search limit",
      description,
      duration: 8000,
    });
  },

  csvUnreadable: (why: string) => error("Can't read that CSV", why),
  /** One toast that morphs from loading to the result; `run` rejects with a user-safe message. */
  importCsv: (rows: number, run: Promise<ImportSummary>) => {
    announce(`Adding ${rows} from your CSV`);
    return sileo.promise(run, {
      loading: { title: `Adding ${rows} from your CSV` },
      success: (r) => importResult(r),
      error: (err) => {
        const why =
          err instanceof Error ? err.message : "Nothing was imported.";
        announce(`Nothing added. ${why}`, true);
        return { title: "Nothing added", description: why, duration: null };
      },
    });
  },

  offline: () => {
    let back = () => {};
    const online = new Promise<void>((resolve) => (back = resolve));
    const description = "Changes can't save until you're back online.";
    announce(`No connection. ${description}`, true);
    sileo.promise(online, {
      loading: { title: "No connection", description },
      success: () => {
        announce("Back online. Changes save again.");
        return {
          title: "Back online",
          description: "Changes save again.",
          duration: 4000,
        };
      },
      error: { title: "No connection" },
    });
    return back;
  },

  dismiss: (id: string) => sileo.dismiss(id),
  /** Escape: clear timed toasts, never sticky errors or offline. */
  dismissTransient: () => {
    transient.forEach(sileo.dismiss);
    transient.clear();
  },
};
