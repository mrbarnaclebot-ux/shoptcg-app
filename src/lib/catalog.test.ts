import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/open";
import * as schema from "@/db/schema";
import {
  chargeMiss,
  MISSES_PER_HOUR,
  parseQuery,
  searchCatalog,
  upsertHits,
} from "@/lib/catalog";
import { SearchError } from "@/lib/pricing/errors";
import type { CatalogHit } from "@/lib/pricing/provider";
import { fakeProvider, hit, migratedDb } from "@/lib/test-fixtures";

let db: Db;

beforeAll(async () => {
  db = await migratedDb();
});

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

  it("serves number/total queries like 199/165 from the cache", async () => {
    const provider = fakeProvider([hit()]);
    const beforeMiss = vi.fn(async () => {});
    const opts = { kind: "raw", language: "en" } as const;
    const rows = await searchCatalog(
      db,
      "199/0165",
      opts,
      provider,
      beforeMiss,
    );
    expect(rows.map((r) => r.number)).toEqual(["199/165"]);
    // A different set total is not the same card, so it asks the provider.
    await searchCatalog(db, "charizard 199/999", opts, provider, beforeMiss);
    expect(provider.search).toHaveBeenCalledTimes(1);
    expect(provider.search).toHaveBeenCalledWith(
      expect.objectContaining({ number: "199", setTotal: "999", limit: 10 }),
    );
    expect(beforeMiss).toHaveBeenCalledTimes(1);
  });

  it("caches empty provider results for the same query", async () => {
    const provider = fakeProvider([]);
    const opts = { kind: "raw", language: "en" } as const;
    expect(await searchCatalog(db, "Nothing  404", opts, provider)).toEqual([]);
    expect(await searchCatalog(db, "nothing 404", opts, provider)).toEqual([]);
    expect(provider.search).toHaveBeenCalledTimes(1);
  });

  it("drops hits missing id, name or set and unsafe image URLs", async () => {
    const other = (over: Partial<CatalogHit>) =>
      hit({ provider: "other", ...over });
    const rows = await upsertHits(db, [
      other({ providerId: "" }),
      other({ providerId: "a", name: "" }),
      other({ providerId: "b", setName: "" }),
      other({ providerId: "c", imageUrl: "http://assets.tcgdex.net/x.webp" }),
      other({ providerId: "d", imageUrl: "https://evil.example/x.webp" }),
    ]);
    expect(rows.map((r) => [r.providerId, r.imageUrl])).toEqual([
      ["c", null],
      ["d", null],
    ]);
  });

  it("limits provider calls per user per hour", async () => {
    await db.insert(schema.user).values({ id: "u1", name: "U", email: "u@x" });
    for (let i = 0; i < MISSES_PER_HOUR; i++) await chargeMiss(db, "u1");
    await expect(chargeMiss(db, "u1")).rejects.toBeInstanceOf(SearchError);
    // Cache hits never charge.
    const beforeMiss = () => chargeMiss(db, "u1");
    const opts = { kind: "raw", language: "en" } as const;
    const rows = await searchCatalog(
      db,
      "charizard",
      opts,
      fakeProvider([]),
      beforeMiss,
    );
    expect(rows.length).toBeGreaterThan(0);
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
