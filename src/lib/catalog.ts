import { and, count, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import {
  catalogItem,
  pricePoint,
  searchMiss,
  type CatalogItem,
} from "@/db/schema";
import { SearchBusyError, SearchLimitError } from "@/lib/pricing/errors";
import { safeImageUrl } from "@/lib/pricing/images";
import {
  defaultProvider,
  type CatalogHit,
  type Grader,
  type Kind,
  type Language,
  type PriceProvider,
} from "@/lib/pricing/provider";

const LIMIT = 10;
// A trailing card number, optionally with the set total: "199", "199/165", "TG05", "SV107/SV122".
const NUMBER = /^([a-z]{0,3}\d+)(?:\/([a-z]{0,3}\d+))?$/i;
// Provider calls (cache misses) each signed-in user may cause per hour.
export const MISSES_PER_HOUR = 30;
const QUERY_TTL_MS = 10 * 60_000;
// The provider's answer to each whole query (catalog row ids, maybe none), so
// a repeat costs no provider call and no throttle wait.
// ponytail: per-process, cleared wholesale when big; move to the DB if it must survive restarts.
const answered = new Map<string, { until: number; ids: string[] }>();

/** Splits "charizard 199" or "199/165" into a name and a card number. */
export function parseQuery(text: string) {
  const words = text.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const m = words.length ? NUMBER.exec(words[words.length - 1]) : null;
  if (m) words.pop();
  return {
    text: text.trim(),
    name: words.join(" "),
    number: m?.[1] ?? null,
    setTotal: m?.[2] ?? null,
  };
}

/** Upserts provider hits, refreshing metadata so renamed cards and moved images heal. */
export async function upsertHits(db: Db, hits: CatalogHit[]) {
  // A hit without an id, name or set cannot be priced or shown; drop it.
  const valid = hits
    .filter((h) => h.providerId && h.name && h.setName)
    .map((h) => ({ ...h, imageUrl: safeImageUrl(h.imageUrl) }));
  // One INSERT cannot touch the same row twice, so drop repeated hits first.
  const key = (h: CatalogHit) =>
    [h.provider, h.providerId, h.language, h.grader, h.grade].join("|");
  const unique = [...new Map(valid.map((h) => [key(h), h])).values()];
  if (!unique.length) return [];
  return db
    .insert(catalogItem)
    .values(unique)
    .onConflictDoUpdate({
      target: [
        catalogItem.provider,
        catalogItem.providerId,
        catalogItem.language,
        catalogItem.grader,
        catalogItem.grade,
      ],
      set: {
        name: sql`excluded.name`,
        setName: sql`excluded.set_name`,
        number: sql`excluded.number`,
        imageUrl: sql`excluded.image_url`,
        updatedAt: sql`now()`,
      },
    })
    .returning();
}

/**
 * The graded row for a raw catalog card at this grader and grade, made on
 * first use so each slab keeps its own price history. Null if the card is gone
 * or isn't a raw card.
 */
export async function gradedItem(
  db: Db,
  cardId: string,
  grader: Grader,
  grade: string,
) {
  const [card] = await db
    .select()
    .from(catalogItem)
    .where(and(eq(catalogItem.id, cardId), eq(catalogItem.kind, "raw")));
  if (!card) return null;
  const { provider, providerId, language, name, setName, number, imageUrl } =
    card;
  const [row] = await upsertHits(db, [
    {
      provider,
      providerId,
      language,
      name,
      setName,
      number,
      imageUrl,
      kind: "graded",
      grader,
      grade,
    },
  ]);
  return row ?? null;
}

// Leading zeros and case never matter: "006" is "6", "tg05" is "TG5".
const norm = (s: string) => sql`ltrim(lower(${s}), '0')`;
const normJs = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/^0+/, "");
// LIKE's wildcards and its escape character, matched literally.
const contains = (s: string) => `%${s.replace(/[\\%_]/g, "\\$&")}%`;

/** Each word of the box; one shaped like a card number also carries it. */
function words(text: string) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const m = NUMBER.exec(w);
      return { text: w, number: m?.[1] ?? null, total: m?.[2] ?? null };
    });
}

// Rows read before ranking.
// ponytail: unindexed ILIKE, fine while catalog_item only holds cached hits.
// Past ~100k rows, add a pg_trgm GIN index on lower(name || ' ' || set_name)
// (sketched in PR #27) and rank in SQL instead of reading LOCAL_SCAN rows.
const LOCAL_SCAN = 200;
// Rows shown: the provider's page plus what the cache adds.
export const SHOWN = 20;

type SearchOpts = { kind: Kind; language: Language };

/**
 * Cached rows where every word is in the name or set name, in any order and
 * as part of a word ("char", "base set", "ex charizard"). A word shaped like
 * a card number may match the number instead; with a set total ("199/165")
 * it must.
 */
async function searchLocal(
  db: Db,
  provider: string,
  text: string,
  opts: SearchOpts,
) {
  const ws = words(text);
  if (!ws.length) return [];
  const hay = sql`lower(${catalogItem.name} || ' ' || ${catalogItem.setName})`;
  // PPT stores "199/165"; TCGdex stores "199" and so never matches a set total.
  const part = (i: number) =>
    sql`ltrim(lower(split_part(${catalogItem.number}, '/', ${i})), '0')`;
  const conds = ws.map((w) => {
    const word = sql`${hay} like ${contains(w.text)}`;
    if (!w.number) return word;
    const num = sql`${part(1)} = ${norm(w.number)}`;
    return w.total
      ? and(num, sql`${part(2)} = ${norm(w.total)}`)
      : or(num, word);
  });
  const rows = await db
    .select()
    .from(catalogItem)
    .where(
      and(
        eq(catalogItem.provider, provider),
        eq(catalogItem.kind, opts.kind),
        eq(catalogItem.language, opts.language),
        ...conds,
      ),
    )
    .orderBy(catalogItem.name, catalogItem.id)
    .limit(LOCAL_SCAN);
  return mergeRows(text, rows, []);
}

/**
 * 0: a word is the card number. 1: the name starts with a word. 2: every word
 * is in the name or set. 3: none of those (the provider's own match).
 */
export function rank(
  row: Pick<CatalogItem, "name" | "setName" | "number">,
  text: string,
) {
  const ws = words(text);
  const num = normJs(row.number?.split("/")[0]);
  if (num && ws.some((w) => w.number && normJs(w.number) === num)) return 0;
  const name = row.name.toLowerCase();
  if (ws.some((w) => !w.number && name.startsWith(w.text))) return 1;
  const hay = `${name} ${row.setName.toLowerCase()}`;
  return ws.every((w) => hay.includes(w.text)) ? 2 : 3;
}

/** One row per id, best rank first; ties keep local before provider order. */
export function mergeRows<T extends CatalogItem>(
  text: string,
  local: T[],
  remote: T[],
) {
  const seen = new Set<string>();
  return [...local, ...remote]
    .filter((r) => !seen.has(r.id) && seen.add(r.id))
    .map((row, i) => ({ row, i, r: rank(row, text) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, SHOWN)
    .map((x) => x.row);
}

export interface MissLimit {
  /** Throws a SearchLimitError when no provider call is left this hour. */
  check(): Promise<void>;
  /** Counts one provider call against the hour. */
  record(): Promise<void>;
}

const noLimit: MissLimit = { check: async () => {}, record: async () => {} };

/** The hourly provider-call cap for one user. */
export function missLimit(db: Db, userId: string): MissLimit {
  return {
    async check() {
      const since = new Date(Date.now() - 3_600_000);
      const [{ n }] = await db
        .select({ n: count() })
        .from(searchMiss)
        .where(and(eq(searchMiss.userId, userId), gt(searchMiss.at, since)));
      // ponytail: count-then-insert lets concurrent requests overshoot by a few; fine for a credit guard.
      if (n >= MISSES_PER_HOUR)
        throw new SearchLimitError(
          "Search limit reached for this hour. Results already in the catalog still work.",
        );
    },
    async record() {
      await db.insert(searchMiss).values({ userId });
    },
  };
}

// A graded search returns the raw cards, one per card; the grade is picked
// when adding, and `gradedItem` makes that row.
const asRaw = (o: SearchOpts): SearchOpts => ({
  ...o,
  kind: o.kind === "graded" ? "raw" : o.kind,
});

const queryKey = (provider: string, o: SearchOpts, text: string) =>
  [provider, o.kind, o.language, text.trim().toLowerCase()]
    .join("|")
    .replace(/\s+/g, " ");

/** The provider's answer to this whole query in the last 10 minutes, if any. */
function recentAnswer(provider: string, o: SearchOpts, text: string) {
  const seen = answered.get(queryKey(provider, o, text));
  return seen && seen.until > Date.now() ? seen.ids : null;
}

/**
 * The provider's answer to the whole query: from the last 10 minutes, else a
 * call, upserting what it returns. `limit` is checked before a call and
 * charged after it, unless the throttle refused the call as busy (nothing was
 * sent).
 */
async function askProvider(
  db: Db,
  text: string,
  o: SearchOpts,
  provider: PriceProvider,
  limit: MissLimit,
) {
  const seen = recentAnswer(provider.name, o, text);
  if (seen) return byIds(db, seen);
  const q = parseQuery(text);
  await limit.check();
  const hits = await provider
    .search({ ...q, kind: o.kind, language: o.language, limit: LIMIT })
    .catch(async (err) => {
      if (!(err instanceof SearchBusyError)) await limit.record();
      throw err;
    });
  await limit.record();
  const rows = await upsertHits(db, hits);
  if (answered.size > 10_000) answered.clear();
  answered.set(queryKey(provider.name, o, text), {
    until: Date.now() + QUERY_TTL_MS,
    ids: rows.map((r) => r.id),
  });
  return rows;
}

/**
 * The add flow's first, instant answer: cached rows, merged with the
 * provider's recent answer to this query if there is one. `answered` says
 * that answer exists, so asking the provider again would add nothing.
 */
export async function searchCached(
  db: Db,
  text: string,
  opts: SearchOpts,
  providerName = defaultProvider().name,
) {
  if (!words(text).length) return { items: [], answered: true };
  const o = asRaw(opts);
  const seen = recentAnswer(providerName, o, text);
  const local = await searchLocal(db, providerName, text, o);
  return {
    items: mergeRows(text, local, seen ? await byIds(db, seen) : []),
    answered: Boolean(seen),
  };
}

/** The add flow's second answer: cached rows merged with the provider's. */
export async function searchFresh(
  db: Db,
  text: string,
  opts: SearchOpts,
  provider: PriceProvider = defaultProvider(),
  limit: MissLimit = noLimit,
): Promise<CatalogItem[]> {
  if (!words(text).length) return [];
  const o = asRaw(opts);
  const remote = await askProvider(db, text, o, provider, limit);
  // Read the cache after the upsert so renamed rows come back fresh.
  const local = await searchLocal(db, provider.name, text, o);
  return mergeRows(text, local, remote);
}

/**
 * For CSV import, where every row is a search: the provider's recent answer,
 * else any cached hit, else the provider. Cached hits win so a big file costs
 * few provider calls; `pickMatch` then checks set and number exactly.
 */
export async function searchCatalog(
  db: Db,
  text: string,
  opts: SearchOpts,
  provider: PriceProvider = defaultProvider(),
  limit: MissLimit = noLimit,
): Promise<CatalogItem[]> {
  if (!words(text).length) return [];
  const o = asRaw(opts);
  const seen = recentAnswer(provider.name, o, text);
  if (seen) return byIds(db, seen);
  const local = await searchLocal(db, provider.name, text, o);
  if (local.length) return local;
  return askProvider(db, text, o, provider, limit);
}

/** Catalog rows in the given order. */
async function byIds(db: Db, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db
    .select()
    .from(catalogItem)
    .where(inArray(catalogItem.id, ids));
  return rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}

/** Why the provider couldn't add to the cached answer. */
export type SearchFailure = "busy" | "limit" | "down";
export type SearchItem = CatalogItem & { market: string | null };

/** Each row with its latest market price (a USD string), null if never priced. */
export async function withMarket(
  db: Db,
  rows: CatalogItem[],
): Promise<SearchItem[]> {
  if (!rows.length) return [];
  const prices = await db
    .selectDistinctOn([pricePoint.catalogItemId], {
      id: pricePoint.catalogItemId,
      market: pricePoint.marketUsd,
    })
    .from(pricePoint)
    .where(
      inArray(
        pricePoint.catalogItemId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(pricePoint.catalogItemId, desc(pricePoint.date));
  const market = new Map(prices.map((p) => [p.id, p.market]));
  return rows.map((r) => ({ ...r, market: market.get(r.id) ?? null }));
}
