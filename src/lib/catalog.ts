import { and, count, eq, gt, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import { catalogItem, searchMiss, type CatalogItem } from "@/db/schema";
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

function searchLocal(
  db: Db,
  provider: string,
  q: ReturnType<typeof parseQuery>,
  opts: { kind: Kind; language: Language },
) {
  const conds = [
    eq(catalogItem.provider, provider),
    eq(catalogItem.kind, opts.kind),
    eq(catalogItem.language, opts.language),
  ];
  // Prefix match so the lower(name) text_pattern_ops index applies.
  // Escape LIKE's wildcards and its escape character so they match literally.
  const prefix = q.name.toLowerCase().replace(/[\\%_]/g, "\\$&") + "%";
  if (q.name) conds.push(sql`lower(${catalogItem.name}) like ${prefix}`);
  // PPT stores "199/165"; TCGdex stores "199" and so never matches a set total.
  const part = (i: number) =>
    sql`ltrim(lower(split_part(${catalogItem.number}, '/', ${i})), '0')`;
  if (q.number) conds.push(sql`${part(1)} = ${norm(q.number)}`);
  if (q.setTotal) conds.push(sql`${part(2)} = ${norm(q.setTotal)}`);
  return db
    .select()
    .from(catalogItem)
    .where(and(...conds))
    .limit(LIMIT);
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

/**
 * The provider's answer to the same query in the last 10 minutes, else the
 * local cache, else the provider, upserting what it returns.
 * `limit` is checked before a provider call and charged after it, unless the
 * throttle refused the call as busy (nothing was sent).
 * Any local hit wins, so a partly cached name returns only what was cached;
 * `force` skips the cache for the add flow's "Search more".
 * A graded search returns the raw cards, one per card; the grade is picked
 * when adding, and `gradedItem` makes that row.
 */
export async function searchCatalog(
  db: Db,
  text: string,
  {
    kind: wanted,
    ...rest
  }: { kind: Kind; language: Language; force?: boolean },
  provider: PriceProvider = defaultProvider(),
  limit: MissLimit = noLimit,
): Promise<CatalogItem[]> {
  const opts = { ...rest, kind: wanted === "graded" ? "raw" : wanted };
  const q = parseQuery(text);
  if (!q.name && !q.number) return [];
  const key = [provider.name, opts.kind, opts.language, q.text.toLowerCase()]
    .join("|")
    .replace(/\s+/g, " ");
  // The provider's own recent answer beats a partial prefix match.
  const seen = answered.get(key);
  if (seen && seen.until > Date.now()) return byIds(db, seen.ids);
  if (!opts.force) {
    const local = await searchLocal(db, provider.name, q, opts);
    if (local.length) return local;
  }
  await limit.check();
  const hits = await provider
    .search({ ...q, kind: opts.kind, language: opts.language, limit: LIMIT })
    .catch(async (err) => {
      if (!(err instanceof SearchBusyError)) await limit.record();
      throw err;
    });
  await limit.record();
  const rows = await upsertHits(db, hits);
  if (answered.size > 10_000) answered.clear();
  const ids = rows.map((r) => r.id);
  answered.set(key, { until: Date.now() + QUERY_TTL_MS, ids });
  return rows;
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
