import { sql } from "drizzle-orm";
import { store } from "@/db/schema";

export type StoreState = "open" | "paused" | "off";

const WINDOW = sql.raw(`interval '14 hours'`);
// An online store has no show to go home from, so its open window never ends.
const ENDLESS = sql`${store.sellingMode} = 'online'`;
// When the current open window began: a timed pause that ran out reopened it.
const openedFrom = sql`case when ${store.state} = 'open' then ${store.openedAt} else ${store.pausedUntil} end`;

/**
 * What buyers get, from what the vendor chose plus the clock: a timed pause
 * that has run out is open again, and a table store's open window ends 14 hours
 * after it began (an online store's never does). An admin's stop wins over all of it. Computed on every read so no job has to flip rows. Every reader and
 * createRequest use this, so a store can never be open in one place and not another.
 */
export const storeState = sql<StoreState>`case
  when ${store.suspendedAt} is not null then 'off'
  when ${store.state} = 'off' then 'off'
  when ${store.state} = 'open' and (${ENDLESS} or ${store.openedAt} > now() - ${WINDOW}) then 'open'
  when ${store.state} = 'paused' and ${store.pausedUntil} <= now()
    and (${ENDLESS} or ${store.pausedUntil} > now() - ${WINDOW}) then 'open'
  else 'paused' end`;

/** Whole minutes until a timed pause ends, if one is still running. */
export const resumesInMin = sql<number | null>`case
  when ${store.state} = 'paused' and ${store.pausedUntil} > now()
  then ceil(extract(epoch from ${store.pausedUntil} - now()) / 60)::int end`;

/**
 * Milliseconds until a timer changes storeState (a pause ending, or the 14-hour
 * window closing), so an open page can re-read at that moment. Null if none.
 */
export const changesInMs = sql<number | null>`(extract(epoch from case
  when ${store.state} = 'paused' and ${store.pausedUntil} > now() then ${store.pausedUntil}
  when ${storeState} = 'open' and not ${ENDLESS} then ${openedFrom} + ${WINDOW}
  end - now()) * 1000)::bigint`.mapWith((v) => (v === null ? null : Number(v)));

/** True when an open window (opened, or a timed pause that ran out) closed after 14 hours. */
// coalesce: an open-ended pause has no paused_until, which would make this null.
export const autoPaused = sql<boolean>`coalesce(${storeState} = 'paused' and (${store.state} = 'open'
  or (${store.state} = 'paused' and ${store.pausedUntil} <= now())), false)`;
