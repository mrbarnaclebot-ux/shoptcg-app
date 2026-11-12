import { sql } from "drizzle-orm";
import type { Db } from "@/db/open";

// Realtime is Postgres LISTEN/NOTIFY: pg_notify inside a transaction is
// delivered on commit and never for a rollback, so a screen can only hear
// about a request that exists. Payloads carry ids only; screens re-read.

// "floor" is a buyer arriving or changing an unsent list; it carries no request.
export type LiveType =
  "new" | "expired" | "declined" | "cancelled" | "confirmed" | "floor";
export type LiveEvent = { s: string; r: string; t: LiveType };

const CHANNEL = "live";

/** Queue an event. Pass the transaction so it rides on the commit. */
export async function notifyLive(db: Db, e: LiveEvent) {
  await db.execute(sql`select pg_notify(${CHANNEL}, ${JSON.stringify(e)})`);
}

// postgres-js and PGlite both expose listen(channel, cb) on the raw client.
type Listener = {
  listen(channel: string, cb: (payload: string) => void): Promise<unknown>;
};

export type Hub = { target: EventTarget; ready: Promise<unknown> };

/** One LISTEN connection, fanned out to subscribers keyed "s:<store>" and "r:<request>". */
export function createHub(db: Db): Hub {
  const target = new EventTarget();
  const client = (db as unknown as { $client: Listener }).$client;
  const ready = client.listen(CHANNEL, (raw) => {
    let e: LiveEvent;
    try {
      e = JSON.parse(raw) as LiveEvent;
    } catch {
      return;
    }
    for (const key of [`s:${e.s}`, `r:${e.r}`])
      target.dispatchEvent(new CustomEvent(key, { detail: e }));
  });
  return { target, ready };
}

export async function subscribe(
  hub: Hub,
  key: string,
  cb: (e: LiveEvent) => void,
) {
  await hub.ready;
  const h = (ev: Event) => cb((ev as CustomEvent<LiveEvent>).detail);
  hub.target.addEventListener(key, h);
  return () => hub.target.removeEventListener(key, h);
}

// Route handler bundles each get their own module copy, so the hub lives on globalThis.
const g = globalThis as { shoptcgLive?: Hub };

/** The process-wide hub; a failed LISTEN is dropped so the next caller retries. */
export function liveHub(db: Db): Hub {
  if (!g.shoptcgLive) {
    const hub = createHub(db);
    hub.ready.catch(() => {
      if (g.shoptcgLive === hub) g.shoptcgLive = undefined;
    });
    g.shoptcgLive = hub;
  }
  return g.shoptcgLive;
}
