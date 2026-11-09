import { and, count, eq, gt, sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import { catalogItem, searchMiss, type CatalogItem } from "@/db/schema";
import { SearchLimitError } from "@/lib/pricing/errors";
import { safeImageUrl } from "@/lib/pricing/images";
import {
  defaultProvider,
  type CatalogHit,
  type Kind,
  type Language,
  type PriceProvider,
} from "@/lib/pricing/provider";

const LIMIT = 10;
// A trailing card number, optionally with the set total: "199", "199/165", "TG05", "SV107/SV122".
const NUMBER = /^([a-z]{0,3}\d+)(?:\/([a-z]{0,3}\d+))?$/i;
// Provider calls (cache misses) each signed-in user may cause per hour.
export const MISSES_PER_HOUR = 30;
const EMPTY_TTL_MS = 10 * 60_000;
// ponytail: per-process negative cache, cleared wholesale when big; move to the DB if it must survive restarts.
const emptyUntil = new Map<string, number>();

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
  const prefix = q.name.toLowerCase().replace(/[\%_]/g, "\$&") + "%";
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

/** Throws a SearchError once a user has caused MISSES_PER_HOUR provider calls this hour. */
export async function chargeMiss(db: Db, userId: string) {
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
  await db.insert(searchMiss).values({ userId });
}

/**
 * Local cache first, then the provider, upserting what it returns.
 * `beforeMiss` runs only when the provider is about to be called (e.g. chargeMiss).
 * Any local hit wins, so a partly cached name returns only what was cached;
 * `force` skips the cache for the add flow's "Search more".
 */
export async function searchCatalog(
  db: Db,
  text: string,
  opts: { kind: Kind; language: Language; force?: boolean },
  provider: PriceProvider = defaultProvider(),
  beforeMiss: () => Promise<void> = async () => {},
): Promise<CatalogItem[]> {
  const q = parseQuery(text);
  if (!q.name && !q.number) return [];
  if (!opts.force) {
    const local = await searchLocal(db, provider.name, q, opts);
    if (local.length) return local;
  }
  const key = [provider.name, opts.kind, opts.language, q.text.toLowerCase()]
    .join("|")
    .replace(/\s+/g, " ");
  if ((emptyUntil.get(key) ?? 0) > Date.now()) return [];
  await beforeMiss();
  const rows = await upsertHits(
    db,
    await provider.search({
      ...q,
      kind: opts.kind,
      language: opts.language,
      limit: LIMIT,
    }),
  );
  if (!rows.length) {
    if (emptyUntil.size > 10_000) emptyUntil.clear();
    emptyUntil.set(key, Date.now() + EMPTY_TTL_MS);
  }
  return rows;
}
