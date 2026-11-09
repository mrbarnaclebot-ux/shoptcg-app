import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/open";
import * as schema from "@/db/schema";
import { upsertHits } from "@/lib/catalog";
import {
  getPublicItem,
  getPublicStore,
  historyPoints,
  listPublicStock,
  storeSummary,
  type PublicStore,
} from "@/lib/storefront";
import { addStore, hit, migratedDb } from "@/lib/test-fixtures";

let db: Db;
let s: PublicStore;
let otherId: string;
let ids: Record<string, string>;

const custom = (storeId: string, over: Partial<schema.NewListing>) => ({
  storeId,
  kind: "raw" as const,
  language: "en" as const,
  condition: "NM" as const,
  ...over,
});

beforeAll(async () => {
  db = await migratedDb();
  const id = await addStore(db, "pub");
  otherId = await addStore(db, "other");
  await db
    .update(schema.store)
    .set({ secondCurrency: "AUD", fxRate: "1.52" })
    .where(eq(schema.store.id, id));
  s = (await getPublicStore(db, "store-pub"))!;
  const [item] = await upsertHits(db, [hit()]);
  await db.insert(schema.pricePoint).values(
    ["2026-10-01", "2026-11-01", "2026-11-08"].map((date, i) => ({
      catalogItemId: item.id,
      date,
      marketUsd: String(40 + i * 5),
      source: "fake",
    })),
  );
  const rows = await db
    .insert(schema.listing)
    .values([
      custom(id, { catalogItemId: item.id, overridePrice: "45", qty: 2 }),
      custom(id, { name: "Pikachu JP", language: "ja", overridePrice: "20" }),
      custom(id, { name: "Old slab", qty: 0, overridePrice: "999" }),
      custom(id, { name: "Hidden one", active: false, overridePrice: "5" }),
      custom(otherId, { name: "Theirs", overridePrice: "1" }),
    ])
    .returning({ id: schema.listing.id });
  ids = { zard: rows[0].id, jp: rows[1].id, sold: rows[2].id };
  ids.hidden = rows[3].id;
  ids.theirs = rows[4].id;
});

describe("listPublicStock", () => {
  it("prices, stamps and converts, with sold out last", async () => {
    const rows = await listPublicStock(db, s);
    expect(rows.map((r) => r.name)).toEqual([
      "Charizard ex",
      "Pikachu JP",
      "Old slab",
    ]);
    expect(rows[0]).toMatchObject({ price: 45, market: 50, underPct: 10 });
    expect(rows[0].alt).toBeCloseTo(68.4);
    expect(rows[2]).toMatchObject({ available: 0 });
  });

  it("filters by type, languages and search", async () => {
    const names = async (f: Parameters<typeof listPublicStock>[2]) =>
      (await listPublicStock(db, s, f)).map((r) => r.name);
    expect(await names({ langs: ["ja", "zh"] })).toEqual(["Pikachu JP"]);
    expect(await names({ type: "graded" })).toEqual([]);
    expect(await names({ q: "199" })).toEqual(["Charizard ex"]);
    expect(await names({ sort: "price-asc" })).toEqual([
      "Pikachu JP",
      "Charizard ex",
      "Old slab",
    ]);
  });
});

describe("getPublicItem", () => {
  it("resolves only this store's active listings", async () => {
    expect((await getPublicItem(db, s, ids.jp))?.name).toBe("Pikachu JP");
    expect(await getPublicItem(db, s, ids.hidden)).toBeNull();
    expect(await getPublicItem(db, s, ids.theirs)).toBeNull();
    expect(await getPublicItem(db, s, "not-a-uuid")).toBeNull();
  });
});

describe("summary and history", () => {
  it("counts active items and finds the newest price date", async () => {
    expect(await storeSummary(db, s.id)).toEqual({
      items: 3,
      updatedOn: "2026-11-08",
    });
  });

  it("returns the window oldest first", async () => {
    const item = await getPublicItem(db, s, ids.zard);
    const pts = await historyPoints(db, item!.catalogItemId!, 30, "2026-11-09");
    expect(pts).toEqual([
      { date: "2026-11-01", market: 45 },
      { date: "2026-11-08", market: 50 },
    ]);
  });
});
