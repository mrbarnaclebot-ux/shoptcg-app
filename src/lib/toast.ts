import { createElement as h, Fragment, type ReactNode } from "react";
import { sileo, type SileoOptions } from "sileo";
import { certNo, usd } from "@/lib/format";

// The app's whole toast vocabulary (PERSONALITY.md state map, Direction B copy;
// Direction C only for the three earned moments). Copy lives here, nowhere else.

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
/** A non-error toast plus its spoken text (titles and spec blocks are not plain strings). */
// Escape dismisses only these; sticky errors and offline stay until resolved.
const transient = new Set<string>();

function show(kind: Kind, say: string, opts: SileoOptions) {
  announce(say);
  const id = sileo[kind](opts);
  transient.add(id);
  return id;
}

// Sileo types title as string but renders it as a React child; the cert stamp
// after the hairline needs its own span.
function head(title: string, stamp?: string) {
  if (!stamp) return title;
  return h(
    Fragment,
    null,
    title,
    h("span", { "data-stamp": "" }, stamp),
  ) as unknown as string;
}

/** Tabular spec block with ruler ticks, the lab readout under a toast title. */
function spec(rows: [string, ReactNode][], lead?: string) {
  return h(
    Fragment,
    null,
    lead && h("b", null, lead),
    h(
      "dl",
      { "data-spec": "" },
      rows.flatMap(([k, v]) => [
        h("dt", { key: `${k}t` }, k),
        h("dd", { key: `${k}d` }, v),
      ]),
    ),
    h("span", { "data-ticks": "", "aria-hidden": true }),
  );
}

const RIP: SileoOptions["styles"] = { title: "toast-rip" };

function error(title: string, description: string, stamp?: string) {
  announce(`${title}. ${description}`, true);
  return sileo.error({
    title: head(title, stamp),
    description,
    duration: null,
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
  const rows: [string, ReactNode][] = [["Logged", r.count]];
  if (r.unpriced) rows.push(["Set a price", r.unpriced]);
  if (r.rejected.length) rows.push(["Rejected rows", r.rejected.join(", ")]);
  const review = r.unpriced > 0 || r.rejected.length > 0;
  announce(rows.map(([k, v]) => `${k} ${v}`).join(". "));
  return {
    title: head(`${r.count} logged`, "CSV"),
    description: spec(rows),
    duration: review ? 8000 : 5000,
  };
}

export const toast = {
  linkSent: (email: string) => {
    const description = `To ${email}. Valid 5 min, single use.`;
    return show("success", `Link sent. ${description}`, {
      title: "Link sent",
      description,
      duration: 6000,
    });
  },
  linkExpired: () =>
    error("Link expired", "Single use, 5 min. Request a new one below."),
  sendFailed: (why: string) => error("Not sent", why),
  rateLimited: () => {
    const description =
      "Too many links requested. Wait a few minutes, then try again.";
    return show("warning", `Limit reached. ${description}`, {
      title: "Limit reached",
      description,
      duration: 8000,
    });
  },

  storeCreated: (slug: string) => {
    const description = `shoptcg.app/${slug} is live. Time to stock it.`;
    return show("success", `You're open. ${description}`, {
      title: "You're open",
      description,
      styles: RIP,
      duration: 6000,
    });
  },
  slugTaken: (slug: string) =>
    error("Slug taken", `"${slug}" is in use. Try "${slug}-cards".`),

  settingsSaved: (pct: number, rounding: number) => {
    const description = `Rule: market ${pct > 0 ? "+" : ""}${pct}%, ${rounding ? `round to ${usd(rounding)}` : "exact cents"}.`;
    return show("success", `Settings saved. ${description}`, {
      title: "Settings saved",
      description,
      duration: 4000,
    });
  },
  notSaved: (why: string) => error("Not saved", why),

  itemAdded: (item: LoggedItem) => {
    const price = item.price == null ? "Market rule" : usd(item.price);
    const what = `${item.name}${item.condition ? `, ${item.condition}` : ""}, ${price}`;
    if (item.first) {
      const description = `Your table is live. ${what}.`;
      return show("success", `First hit logged. ${description}`, {
        title: "First hit logged",
        description,
        styles: RIP,
        duration: 6000,
      });
    }
    const rows: [string, ReactNode][] = [
      ["Qty", item.qty],
      ["Your price", price],
    ];
    if (item.condition) rows.unshift(["Condition", item.condition]);
    return show("success", `Logged. ${what}, qty ${item.qty}.`, {
      title: head("Logged", certNo(item.id)),
      description: spec(rows, item.name),
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
    const description = `${name} is off your public table.`;
    return show("info", `Hidden. ${description}`, {
      title: head("Hidden", certNo(id)),
      description,
      duration: 5000,
    });
  },
  qtyZero: (name: string, onHide: () => void) => {
    const description = `${name} shows as sold out.`;
    return show("warning", `Qty 0. ${description}`, {
      title: "Qty 0",
      description,
      button: { title: "Hide item", onClick: onHide },
      duration: 8000,
    });
  },
  qtyFailed: (qty: number) =>
    error(
      "Not saved",
      `Qty change didn't reach the server. Count held at ${qty}.`,
    ),
  searchLimit: (perHour: number) => {
    const description = `${perHour} new lookups per hour. Cards already in the catalog still search.`;
    return show("warning", `Limit reached. ${description}`, {
      title: "Limit reached",
      description,
      duration: 8000,
    });
  },

  csvUnreadable: (why: string) => error("CSV not read", why),
  /** One toast that morphs from loading to the result; `run` rejects with a user-safe message. */
  importCsv: (rows: number, run: Promise<ImportSummary>) => {
    announce(`Importing ${rows}`);
    return sileo.promise(run, {
      loading: { title: head(`Importing ${rows}`, "CSV") },
      success: (r) => importResult(r),
      error: (err) => {
        const why =
          err instanceof Error ? err.message : "Nothing was imported.";
        announce(`Not imported. ${why}`, true);
        return { title: "Not imported", description: why, duration: null };
      },
    });
  },

  offline: () => {
    let back = () => {};
    const online = new Promise<void>((resolve) => (back = resolve));
    const description = "Changes can't save until the connection is back.";
    announce(`Offline. ${description}`, true);
    sileo.promise(online, {
      loading: { title: "Offline", description },
      success: () => {
        announce("Online. Connection restored.");
        return {
          title: "Online",
          description: "Connection restored.",
          duration: 4000,
        };
      },
      error: { title: "Offline" },
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
