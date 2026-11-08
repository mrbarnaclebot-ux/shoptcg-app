import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/open";
import * as schema from "@/db/schema";
import { parseQuery, searchCatalog, upsertHits } from "@/lib/catalog";
import type {
  CatalogHit,
  PriceProvider,
  PriceRef,
} from "@/lib/pricing/provider";
import { syncPrices, totalFailure } from "@/lib/sync-prices";

let db: Db;

beforeAll(async () => {
  db = drizzle(new PGlite(), { schema });
  await migrate(db as Parameters<typeof migrate>[0], {
    migrationsFolder: "drizzle",
  });
});

const hit = (over: Partial<CatalogHit> = {}): CatalogHit => ({
  provider: "fake",
  providerId: "sv03.5-199",
  kind: "raw",
  language: "en",
  name: "Charizard ex",
  setName: "151",
  number: "199",
  imageUrl: null,
  grader: null,
  grade: null,
  ...over,
});

function fakeProvider(hits: CatalogHit[], price = 295.26): PriceProvider {
  return {
    name: "fake",
    search: vi.fn(async () => hits),
    getPrices: async <T extends PriceRef>(refs: T[]) =>
      refs.map((ref) => ({
        ref,
        marketUsd: price,
        lowUsd: null,
        highUsd: null,
        sampleSize: 3,
      })),
    getHistory: async () => [],
  };
}

describe("parseQuery", () => {
  it.each([
    ["charizard 199", { name: "charizard", number: "199", setTotal: null }],
    ["199/165", { name: "", number: "199", setTotal: "165" }],
    ["  pikachu   4/102 ", { name: "pikachu", number: "4", setTotal: "102" }],
    ["charizard ex", { name: "charizard ex", number: null, setTotal: null }],
    [
      "umbreon TG23/TG30",
      { name: "umbreon", number: "TG23", setTotal: "TG30" },
    ],
  ])("parses %j", (text, want) => expect(parseQuery(text)).toMatchObject(want));
});

describe("searchCatalog", () => {
  it("falls back to the provider, then serves the local cache", async () => {
    const provider = fakeProvider([hit(), hit()]);
    const opts = { kind: "raw", language: "en" } as const;
    const first = await searchCatalog(db, "charizard 199", opts, provider);
    expect(first).toHaveLength(1);
    const again = await searchCatalog(db, "Chari 0199", opts, provider);
    expect(again.map((r) => r.id)).toEqual([first[0].id]);
    expect(provider.search).toHaveBeenCalledTimes(1);
  });

  it("matches a PPT-style number with the set total from the cache", async () => {
    const provider = fakeProvider([
      hit({ providerId: "517045", number: "199/165" }),
    ]);
    const opts = { kind: "raw", language: "en" } as const;
    const [row] = await searchCatalog(db, "199/165", opts, provider);
    const again = await searchCatalog(db, "charizard 199", opts, provider);
    expect(again.map((r) => r.id)).toContain(row.id);
    expect(provider.search).toHaveBeenCalledTimes(1);
  });

  it("always asks the provider when a set total is given", async () => {
    const provider = fakeProvider([hit()]);
    const opts = { kind: "raw", language: "en" } as const;
    await searchCatalog(db, "199/165", opts, provider);
    expect(provider.search).toHaveBeenCalledWith(
      expect.objectContaining({ number: "199", setTotal: "165", limit: 10 }),
    );
  });

  it("keeps one row per grade and rejects inconsistent graded rows", async () => {
    const psa = hit({ kind: "graded", grader: "PSA", grade: "10" });
    await upsertHits(db, [
      psa,
      psa,
      hit({ kind: "graded", grader: "PSA", grade: "9.5" }),
    ]);
    const rows = await db
      .select()
      .from(schema.catalogItem)
      .where(eq(schema.catalogItem.kind, "graded"));
    expect(rows).toHaveLength(2);
    for (const bad of [
      hit({ providerId: "x", kind: "graded" }),
      hit({ providerId: "y", grader: "PSA", grade: "10" }),
      hit({ providerId: "z", kind: "graded", grader: "PSA", grade: "11" }),
    ])
      await expect(db.insert(schema.catalogItem).values(bad)).rejects.toThrow();
  });
});

describe("syncPrices", () => {
  it("is idempotent per day and skips providers without an adapter", async () => {
    await upsertHits(db, [hit({ provider: "nokey", providerId: "n1" })]);
    const pick = (price: number) => (name: string) =>
      name === "fake" ? fakeProvider([], price) : null;
    const first = await syncPrices(db, "2026-11-08", pick(10));
    const second = await syncPrices(db, "2026-11-08", pick(12.5));
    expect(second).toEqual(first);
    expect(first).toMatchObject({ written: 4, skipped: 1, failed: 0 });
    const points = await db.select().from(schema.pricePoint);
    expect(points).toHaveLength(4);
    expect(
      points.every((p) => p.marketUsd === "12.5" && p.source === "fake"),
    ).toBe(true);
  });

  it("reports total failure when every call throws", async () => {
    const broken = fakeProvider([]);
    broken.getPrices = async () => {
      throw new Error("down");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await syncPrices(db, "2026-11-09", (n) =>
      n === "fake" ? broken : null,
    );
    expect(res).toMatchObject({ written: 0, failed: 4 });
    expect(totalFailure(res)).toBe(true);
  });

  it("stops calling a provider after 3 failed chunks in a row", async () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      hit({ provider: "many", providerId: `m${i}` }),
    );
    await upsertHits(db, many);
    let calls = 0;
    const broken = fakeProvider([]);
    broken.getPrices = async () => {
      calls++;
      throw new Error("PPT 429");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await syncPrices(db, "2026-11-10", (n) =>
      n === "many" ? broken : null,
    );
    expect(calls).toBe(3);
    expect(res).toMatchObject({ written: 0, failed: 80 });
  });
});
