import type { ConfirmInput, ConfirmResult } from "@/lib/sales";

// A sale confirmed with no connection waits here, on this phone, one key per
// request, until it sends. Confirm is safe to repeat (a second one returns
// the first sale), so a resend after a lost response can't record twice. An
// entry goes only when the server records it, a later confirm of that request
// does, or the vendor discards it after a refusal: never silently.

export type SaleInput = Omit<ConfirmInput, "timeZone">;
export type PendingSale = {
  input: SaleInput;
  buyer: string;
  total: string;
  emailed: boolean;
  /** Why the server said no; the entry stays until the vendor acts. */
  refused?: string;
};

const PREFIX = "tcgmart:pending-sale:";
const subs = new Set<() => void>();

function local() {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function changed() {
  subs.forEach((cb) => cb());
}

/** For useSyncExternalStore: other tabs' writes arrive as storage events. */
export function subscribePending(cb: () => void) {
  subs.add(cb);
  addEventListener("storage", cb);
  return () => {
    subs.delete(cb);
    removeEventListener("storage", cb);
  };
}

/** Every waiting sale as one JSON string, so the snapshot compares by value. */
export function pendingSnapshot() {
  const s = local();
  if (!s) return "[]";
  const raw = [];
  for (let i = 0; i < s.length; i++) {
    const key = s.key(i);
    if (key?.startsWith(PREFIX)) raw.push(s.getItem(key));
  }
  return `[${raw.sort().join(",")}]`;
}

export function listPending(): PendingSale[] {
  try {
    return JSON.parse(pendingSnapshot());
  } catch {
    return [];
  }
}

/** False when this phone can't keep it (private mode, storage full). */
export function savePending(p: PendingSale) {
  try {
    local()!.setItem(PREFIX + p.input.requestId, JSON.stringify(p));
  } catch {
    return false;
  }
  changed();
  return true;
}

export function dropPending(requestId: string) {
  try {
    local()?.removeItem(PREFIX + requestId);
  } catch {}
  changed();
}

/** No connection, as opposed to a server that answered with an error. */
export const isNetworkError = (err: unknown) =>
  !navigator.onLine || err instanceof TypeError;

/** What the vendor reads when a waiting sale is refused; null for a recorded one. */
export function refusal(res: ConfirmResult) {
  if ("ok" in res) return null;
  if ("stock" in res)
    return "The stock changed since. Open the request to check it.";
  if ("gone" in res) return "That request was closed before it sent.";
  return "It didn't match the request any more. Open the request to check it.";
}

let sending = false;

/**
 * Sends every waiting sale that hasn't been refused, oldest key first. A
 * network failure stops the round: the rest wait for the next one.
 */
export async function sendPending(
  send: (input: SaleInput) => Promise<ConfirmResult>,
  on: {
    sent: (p: PendingSale, res: Extract<ConfirmResult, { ok: true }>) => void;
    refused: (p: PendingSale, why: string) => void;
  },
) {
  if (sending) return;
  sending = true;
  try {
    for (const p of listPending()) {
      if (p.refused) continue;
      let res: ConfirmResult | undefined;
      try {
        res = await send(p.input);
      } catch {}
      // Still offline, the server failed or the session ended: next round.
      if (!res) break;
      if ("ok" in res) {
        dropPending(p.input.requestId);
        on.sent(p, res);
      } else {
        const why = refusal(res)!;
        savePending({ ...p, refused: why });
        on.refused(p, why);
      }
    }
  } finally {
    sending = false;
  }
}
