import { createElement as h, Fragment, type ReactNode } from "react";
import { sileo, type SileoOptions } from "sileo";
import { certNo, usd } from "@/lib/format";

// The app's whole toast vocabulary (PERSONALITY.md state map, Direction B copy;
// Direction C only for the three earned moments). Copy lives here, nowhere else.

export const ALERT_REGION_ID = "toast-alert";

// Sileo's viewport is aria-live polite for every state; errors also go to an
// assertive region so they interrupt.
function announce(text: string) {
  const el = document.getElementById(ALERT_REGION_ID);
  if (!el) return;
  el.textContent = "";
  setTimeout(() => (el.textContent = text), 50);
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
  announce(`${title}. ${description}`);
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
  return {
    title: head(`${r.count} logged`, "CSV"),
    description: spec(rows),
    duration: review ? 8000 : 5000,
  };
}

export const toast = {
  linkSent: (email: string) =>
    sileo.success({
      title: "Link sent",
      description: `To ${email}. Valid 5 min, single use.`,
      duration: 6000,
    }),
  linkExpired: () =>
    error("Link expired", "Single use, 5 min. Request a new one below."),
  sendFailed: (why: string) => error("Not sent", why),
  rateLimited: () =>
    sileo.warning({
      title: "Limit reached",
      description: "Too many links requested. Wait 60 s, then try again.",
      duration: 8000,
    }),

  storeCreated: (slug: string) =>
    sileo.success({
      title: "You're open",
      description: `shoptcg.app/${slug} is live. Time to stock it.`,
      styles: RIP,
      duration: 6000,
    }),
  slugTaken: (slug: string) =>
    error("Slug taken", `"${slug}" is in use. Try "${slug}-cards".`),

  settingsSaved: (pct: number, rounding: number) =>
    sileo.success({
      title: "Settings saved",
      description: `Rule: market ${pct > 0 ? "+" : ""}${pct}%, ${rounding ? `round to ${usd(rounding)}` : "exact cents"}.`,
      duration: 4000,
    }),
  notSaved: (why: string) => error("Not saved", why),

  itemAdded: (item: LoggedItem) => {
    const price = item.price == null ? "Market rule" : usd(item.price);
    if (item.first)
      return sileo.success({
        title: "First hit logged",
        description: `Your table is live. ${item.name}${item.condition ? `, ${item.condition}` : ""}, ${price}.`,
        styles: RIP,
        duration: 6000,
      });
    const rows: [string, ReactNode][] = [
      ["Qty", item.qty],
      ["Your price", price],
    ];
    if (item.condition) rows.unshift(["Condition", item.condition]);
    return sileo.success({
      title: head("Logged", certNo(item.id)),
      description: spec(rows, item.name),
      duration: 5000,
    });
  },
  itemUpdated: (id: string, name: string, change: string) =>
    sileo.success({
      title: head("Updated", certNo(id)),
      description: `${name}. ${change}`,
      duration: 4000,
    }),
  itemHidden: (id: string, name: string) =>
    sileo.info({
      title: head("Hidden", certNo(id)),
      description: `${name} is off your public table.`,
      duration: 5000,
    }),
  qtyZero: (name: string, onHide: () => void) =>
    sileo.warning({
      title: "Qty 0",
      description: `${name} shows as sold out.`,
      button: { title: "Hide item", onClick: onHide },
      duration: 8000,
    }),
  qtyFailed: (qty: number) =>
    error(
      "Not saved",
      `Qty change didn't reach the server. Count held at ${qty}.`,
    ),
  searchLimit: (perHour: number) =>
    sileo.warning({
      title: "Limit reached",
      description: `${perHour} new lookups per hour. Cards already in the catalog still search.`,
      duration: 8000,
    }),

  csvUnreadable: (why: string) => error("CSV not read", why),
  /** One toast that morphs from loading to the result; `run` rejects with a user-safe message. */
  importCsv: (rows: number, run: Promise<ImportSummary>) =>
    sileo.promise(run, {
      loading: { title: head(`Importing ${rows}`, "CSV") },
      success: (r) => importResult(r),
      error: (err) => {
        const why =
          err instanceof Error ? err.message : "Nothing was imported.";
        announce(`Not imported. ${why}`);
        return { title: "Not imported", description: why, duration: null };
      },
    }),

  offline: () => {
    let back = () => {};
    const online = new Promise<void>((resolve) => (back = resolve));
    sileo.promise(online, {
      loading: {
        title: "Offline",
        description: "Changes can't save until the connection is back.",
      },
      success: {
        title: "Online",
        description: "Connection restored.",
        duration: 4000,
      },
      error: { title: "Offline" },
    });
    return back;
  },

  dismiss: (id: string) => sileo.dismiss(id),
};
