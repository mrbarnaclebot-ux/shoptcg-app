import { PartialPricesError, SearchBusyError } from "./errors";
import {
  cardHit,
  history,
  quote,
  sealedHit,
  type PptCard,
  type PptSealed,
} from "./ppt-map";
import type {
  CatalogHit,
  Language,
  PriceProvider,
  PriceRef,
  Quote,
  SearchQuery,
} from "./provider";

// Shapes from https://www.pokemonpricetracker.com/llms-full.txt, checked against
// live Pro-plan calls on 2026-11-08 (fixtures in ./fixtures are those responses, trimmed).
const BASE = "https://www.pokemonpricetracker.com/api/v2";
// No Chinese coverage on PPT.
const LANG: Partial<Record<Language, string>> = {
  en: "english",
  ja: "japanese",
};
// PPT allows 60 calls/min per key; too many 429s get the key banned. The app
// (search) and the nightly cron (sync) are separate processes with separate
// throttles, so their rates must sum to under 60/min: search 15, sync 45.
export interface Rate {
  gapMs: number;
  /** Fail instead of queueing behind more than this much throttle wait. */
  maxWaitMs: number;
  /**
   * Background work (sync, price on add): never books a slot ahead and steps
   * aside while a search waits, so a vendor's search isn't "busy" behind a
   * big import. Spacing still holds: every call waits out the last one's gap.
   */
  yields?: boolean;
}
export const SEARCH_RATE: Rate = { gapMs: 4_000, maxWaitMs: 5_000 };
export const SYNC_RATE: Rate = {
  gapMs: 1_334,
  maxWaitMs: Infinity,
  yields: true,
};
const MAX_RETRIES = 3;
const MAX_RETRY_AFTER_S = 60;
// Consecutive failed calls in one price batch before giving up on the rest.
const MAX_FAILS_IN_ROW = 3;
// Shared by every adapter instance in this process.
let nextCallAt = 0;
let searchesWaiting = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function throttle(rate: Rate) {
  if (rate.yields) {
    // Take a slot only once it is free now and no search is queued for it.
    for (;;) {
      const wait = nextCallAt - Date.now();
      if (wait <= 0 && !searchesWaiting) break;
      await sleep(Math.max(wait, 50));
    }
    nextCallAt = Date.now() + rate.gapMs;
    return;
  }
  const now = Date.now();
  const wait = nextCallAt - now;
  if (wait > rate.maxWaitMs)
    throw new SearchBusyError("Price search is busy. Try again in a minute.");
  nextCallAt = Math.max(nextCallAt, now) + rate.gapMs;
  if (wait <= 0) return;
  searchesWaiting++;
  try {
    await sleep(wait);
  } finally {
    searchesWaiting--;
  }
}

/** Seconds from Retry-After (capped at 60), else exponential backoff: 5s, 10s, 20s. */
function backoffMs(res: Response, attempt: number) {
  const header = Number(res.headers.get("Retry-After"));
  const s = Number.isFinite(header) && header > 0 ? header : 5 * 2 ** attempt;
  return Math.min(s, MAX_RETRY_AFTER_S) * 1000;
}

type Params = Record<string, string | number | boolean>;
type Client = Rate & { apiKey: string };

async function request(c: Client, path: string, params: Params) {
  for (let attempt = 0; ; attempt++) {
    await throttle(c);
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    );
    const res = await fetch(`${BASE}${path}?${qs}`, {
      headers: { Authorization: `Bearer ${c.apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 404) return null;
    // 429 is rate limit, 503 is their documented "database overload, retry".
    if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
      nextCallAt = Date.now() + backoffMs(res, attempt);
      continue;
    }
    if (!res.ok) throw new Error(`PPT ${res.status} for ${path}`);
    return ((await res.json()) as { data: unknown }).data;
  }
}

// One item per call with limit=1: PPT bills on the requested limit, not results.
async function fetchOne(c: Client, ref: PriceRef, extra: Params = {}) {
  const language = LANG[ref.language] ?? "english";
  const base = { tcgPlayerId: ref.providerId, language, limit: 1, ...extra };
  const graded: Params = ref.kind === "graded" ? { includeEbay: true } : {};
  const data =
    ref.kind === "sealed"
      ? await request(c, "/sealed-products", base)
      : await request(c, "/cards", { ...base, ...graded });
  // The docs say a tcgPlayerId lookup returns one object; /cards does (checked
  // live), /sealed-products is unverified, so a one-item list is read too.
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

async function search(c: Client, q: SearchQuery): Promise<CatalogHit[]> {
  const language = LANG[q.language];
  if (!language || !q.text) return [];
  // The search action already caps the text at 100 characters.
  const params = { search: q.text, language, limit: q.limit };
  if (q.kind === "sealed") {
    const rows = (await request(c, "/sealed-products", params)) ?? [];
    return (rows as PptSealed[]).map((p) => sealedHit(p, q.language));
  }
  // Graded searches arrive as raw (searchCatalog): one hit per card.
  const rows = ((await request(c, "/cards", params)) ?? []) as PptCard[];
  return rows.map((card) => cardHit(card, q.language));
}

const FAILED = Symbol("failed");

/**
 * Prices each ref, sharing one call across grades of a card. A failed call
 * skips only its items; if any failed, the paid-for quotes ride on the
 * PartialPricesError so the caller can still save them.
 */
async function getPrices<T extends PriceRef>(c: Client, refs: T[]) {
  const fetched = new Map<string, unknown>();
  const quotes: Quote<T>[] = [];
  let [failed, inRow, cause]: [number, number, unknown] = [0, 0, null];
  for (const [i, ref] of refs.entries()) {
    if (inRow >= MAX_FAILS_IN_ROW) {
      failed += refs.length - i;
      break;
    }
    const key = `${ref.kind}:${ref.providerId}:${ref.language}`;
    if (!fetched.has(key)) {
      try {
        fetched.set(key, await fetchOne(c, ref));
        inRow = 0;
      } catch (err) {
        [cause, inRow] = [err, inRow + 1];
        fetched.set(key, FAILED);
      }
    }
    const data = fetched.get(key);
    if (data === FAILED) failed++;
    const q = data && data !== FAILED ? quote(ref, data) : null;
    if (q) quotes.push(q);
  }
  if (failed) throw new PartialPricesError(quotes, failed, cause);
  return quotes;
}

async function getHistory(c: Client, ref: PriceRef, days: number) {
  const extra: Params =
    ref.kind === "graded" ? {} : { includeHistory: true, days };
  const data = await fetchOne(c, ref, extra);
  return data ? history(ref, data) : [];
}

export function ppt(apiKey: string, rate: Rate = SEARCH_RATE): PriceProvider {
  const c = { apiKey, ...rate };
  return {
    name: "ppt",
    search: (q) => search(c, q),
    getPrices: (refs) => getPrices(c, refs),
    getHistory: (ref, days) => getHistory(c, ref, days),
  };
}
