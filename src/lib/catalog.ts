import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import { catalogItem, type CatalogItem } from "@/db/schema";
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
  // One INSERT cannot touch the same row twice, so drop repeated hits first.
  const unique = [
    ...new Map(
      hits.map((h) => [
        [h.provider, h.providerId, h.grader, h.grade].join("|"),
        h,
      ]),
    ).values(),
  ];
  if (!unique.length) return [];
  return db
    .insert(catalogItem)
    .values(unique)
    .onConflictDoUpdate({
      target: [
        catalogItem.provider,
        catalogItem.providerId,
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
  const prefix = q.name.toLowerCase().replace(/[\\%_]/g, "\\$&") + "%";
  if (q.name) conds.push(sql`lower(${catalogItem.name}) like ${prefix}`);
  // Providers zero-pad ("006" vs "6") and PPT appends the set total ("199/165").
  if (q.number)
    conds.push(
      sql`ltrim(lower(split_part(${catalogItem.number}, '/', 1)), '0') = ltrim(lower(${q.number}), '0')`,
    );
  return db
    .select()
    .from(catalogItem)
    .where(and(...conds))
    .limit(LIMIT);
}

/**
 * Local cache first, then the provider, upserting what it returns.
 * ponytail: any local hit wins, so a partly cached name returns only what was
 * cached; add a "search more" path that forces the provider in Phase 3.
 */
export async function searchCatalog(
  db: Db,
  text: string,
  opts: { kind: Kind; language: Language },
  provider: PriceProvider = defaultProvider(),
): Promise<CatalogItem[]> {
  const q = parseQuery(text);
  if (!q.name && !q.number) return [];
  // The set total is not stored locally, so "199/165" always asks the provider.
  if (!q.setTotal) {
    const local = await searchLocal(db, provider.name, q, opts);
    if (local.length) return local;
  }
  const hits = await provider.search({ ...q, ...opts, limit: LIMIT });
  return upsertHits(db, hits);
}
