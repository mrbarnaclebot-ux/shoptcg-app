import { sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import { listing, pricePoint, type NewListing } from "@/db/schema";
import { upsertHits } from "@/lib/catalog";
import type { CatalogHit } from "@/lib/pricing/provider";

// A believable table for e2e and screenshots: every state the store page
// draws (stamp, graded, JP, sealed, sold out, hidden, unpriced custom, thin
// history). Only reachable through the env-gated /api/e2e/seed route.

const ART = "https://assets.tcgdex.net/en/sv";

const HITS: (CatalogHit & { market: number; days: number })[] = [
  card(
    "zard",
    "Charizard ex",
    "151",
    "199",
    `${ART}/sv03.5/199/high.webp`,
    295,
    90,
  ),
  card("mew", "Mew ex", "151", "205", `${ART}/sv03.5/205/high.webp`, 48.1, 90),
  card("pika", "Pikachu", "Ancient Roar", "012", null, 18.5, 30, "ja"),
  {
    ...card("umb", "Umbreon VMAX", "Evolving Skies", "215", null, 1310, 30),
    kind: "graded",
    grader: "PSA",
    grade: "10",
  },
  {
    ...card(
      "box",
      "Surging Sparks booster box",
      "Surging Sparks",
      null,
      null,
      139,
      30,
    ),
    kind: "sealed",
  },
  card("thin", "Gengar", "Lost Origin", "066", null, 3.2, 1),
];

function card(
  id: string,
  name: string,
  setName: string,
  number: string | null,
  imageUrl: string | null,
  market: number,
  days: number,
  language: "en" | "ja" = "en",
) {
  return {
    provider: "e2e",
    providerId: id,
    kind: "raw" as const,
    language,
    name,
    setName,
    number,
    imageUrl,
    grader: null,
    grade: null,
    market,
    days,
  };
}

/** A gentle daily wobble ending on today's market, so charts have a shape. */
function history(
  itemId: string,
  market: number,
  days: number,
  today: Date,
  sold: boolean,
) {
  return Array.from({ length: days }, (_, i) => {
    const back = days - 1 - i;
    const date = new Date(+today - back * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const drift = 1 - back * 0.0012 + Math.sin(back / 4) * 0.02;
    return {
      catalogItemId: itemId,
      date,
      marketUsd: (market * drift).toFixed(2),
      // The last week sold a few copies a day (none every fourth), like PPT reports.
      sales: sold && back < 7 ? back % 4 : null,
      source: "e2e",
    };
  });
}

export async function seedDemoStock(db: Db, storeId: string) {
  const rows = await upsertHits(db, HITS);
  const by = new Map(rows.map((r) => [r.providerId, r]));
  const today = new Date();
  await db
    .insert(pricePoint)
    .values(
      HITS.flatMap((h) =>
        history(
          by.get(h.providerId)!.id,
          h.market,
          h.days,
          today,
          h.kind !== "sealed",
        ),
      ),
    )
    // Catalog items are shared across seeded stores: refresh counts, keep prices.
    .onConflictDoUpdate({
      target: [pricePoint.catalogItemId, pricePoint.date, pricePoint.source],
      set: { sales: sql`excluded.sales` },
    });
  const item = (id: string, over: Partial<NewListing> = {}): NewListing => {
    const c = by.get(id)!;
    return {
      storeId,
      catalogItemId: c.id,
      kind: c.kind,
      language: c.language,
      condition: c.kind === "raw" ? "NM" : null,
      qty: 2,
      ...over,
    };
  };
  const inserted = await db
    .insert(listing)
    .values([
      // 10% under the $295 market, so it gets the stamp.
      item("zard", { overridePrice: "265.50", qty: 3 }),
      item("mew", { qty: 1 }),
      item("pika", { qty: 4 }),
      item("umb", { qty: 1 }),
      item("box"),
      item("thin"),
      item("pika", { qty: 0, condition: "LP" }),
      item("mew", { active: false, condition: "LP" }),
      {
        storeId,
        kind: "raw",
        language: "zh",
        name: "Pikachu Gold Star CN promo",
        number: "SM-P 1",
        condition: "NM",
        overridePrice: "25",
      },
    ])
    .returning({ id: listing.id });
  const [zard, , , , , thin, sold, hidden, custom] = inserted.map((r) => r.id);
  return { zard, thin, sold, hidden, custom };
}
