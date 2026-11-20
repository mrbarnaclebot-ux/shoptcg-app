import { useSyncExternalStore } from "react";

// What a buyer typed last time, kept on this phone only, for every store:
// the claim room and the cart fill their forms from it. The key predates the cart.
const KEY = "claim-buyer";
const EVENT = "tcgmart:details";
const FIELDS = ["name", "email", "phone", "address"] as const;

export type Details = Partial<Record<(typeof FIELDS)[number], string>>;

/** Only the known fields, and only strings: the stored value is the phone's to mangle. */
export function parseDetails(raw: string | null): Details {
  try {
    const d = JSON.parse(raw ?? "{}") as Record<string, unknown> | null;
    const out: Details = {};
    for (const k of FIELDS) {
      const v = d?.[k];
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** What was just sent over what was kept; a field left blank keeps the old value. */
export function mergeDetails(had: Details, form: FormData): Details {
  const next = { ...had };
  for (const k of FIELDS) {
    const v = form.get(k);
    if (typeof v === "string" && v.trim()) next[k] = v.trim();
  }
  return next;
}

const raw = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

export const readDetails = () => parseDetails(raw());

function write(value: Details | null) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode: nothing is kept, the form just starts empty next time.
  }
  window.dispatchEvent(new Event(EVENT));
}

export const saveDetails = (form: FormData) =>
  write(mergeDetails(readDetails(), form));

export const clearDetails = () => write(null);

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** The kept details; empty on the server and before hydration. */
export function useDetails() {
  return parseDetails(useSyncExternalStore(subscribe, raw, () => ""));
}
