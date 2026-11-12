import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/open";
import * as schema from "@/db/schema";
import {
  gradedItem,
  MISSES_PER_HOUR,
  missLimit,
  mergeRows,
  parseQuery,
  rank,
  searchCached,
  searchCatalog,
  searchFresh,
  upsertHits,
  withMarket,
} from "@/lib/catalog";
import {
  SearchBusyError,
  SearchError,
  SearchLimitError,
} from "@/lib/pricing/errors";
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
    const again = await searchCatalog(db, "charizard 0199", opts, provider);
    expect(again.map((r) => r.id)).toContain(row.id);
    expect(provider.search).toHaveBeenCalledTimes(1);
  });

  it("serves a repeat of a whole query the prefix cache can't, even on Search more", async () => {
    const provider = fakeProvider([
      hit({ providerId: "q1", name: "Detective Pikachu" }),
    ]);
    const opts = { kind: "raw", language: "en" } as const;
    const first = await searchCatalog(db, "pikachu detective", opts, provider);
    const again = await searchCatalog(db, "Pikachu  Detective", opts, provider);
    const more = await searchFresh(db, "pikachu detective", opts, provider);
    expect(again.map((r) => r.id)).toEqual(first.map((r) => r.id));
    expect(more.map((r) => r.id)).toEqual(first.map((r) => r.id));
    expect(provider.search).toHaveBeenCalledTimes(1);
  });

  it("serves number/total queries like 199/165 from the cache", async () => {
    const provider = fakeProvider([hit()]);
    const limit = {
      check: vi.fn(async () => {}),
      record: vi.fn(async () => {}),
    };
    const opts = { kind: "raw", language: "en" } as const;
    const rows = await searchCatalog(db, "199/0165", opts, provider, limit);
    expect(rows.map((r) => r.number)).toEqual(["199/165"]);
    // A different set total is not the same card, so it asks the provider.
    await searchCatalog(db, "charizard 199/999", opts, provider, limit);
    expect(provider.search).toHaveBeenCalledTimes(1);
    expect(provider.search).toHaveBeenCalledWith(
      expect.objectContaining({ number: "199", setTotal: "999", limit: 10 }),
    );
    expect(limit.record).toHaveBeenCalledTimes(1);
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
    const limit = missLimit(db, "u1");
    for (let i = 0; i < MISSES_PER_HOUR; i++) await limit.record();
    await expect(limit.check()).rejects.toBeInstanceOf(SearchError);
    // Cache hits never charge.
    const opts = { kind: "raw", language: "en" } as const;
    const rows = await searchCatalog(
      db,
      "charizard",
      opts,
      fakeProvider([]),
      limit,
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("charges a provider call, but not one the throttle refused as busy", async () => {
    await db.insert(schema.user).values({ id: "u2", name: "U", email: "u2@x" });
    const misses = async () =>
      (await db.select().from(schema.searchMiss)).filter(
        (m) => m.userId === "u2",
      ).length;
    const limit = missLimit(db, "u2");
    const opts = { kind: "raw", language: "en" } as const;
    const busy = fakeProvider([]);
    vi.mocked(busy.search).mockRejectedValue(new SearchBusyError("busy"));
    await expect(
      searchCatalog(db, "busy 1", opts, busy, limit),
    ).rejects.toBeInstanceOf(SearchBusyError);
    expect(await misses()).toBe(0);
    await searchCatalog(db, "quiet 1", opts, fakeProvider([]), limit);
    expect(await misses()).toBe(1);
  });

  it("matches %, _ and \\ in a name literally", async () => {
    const provider = fakeProvider([]);
    const names = ["100% Pikachu", "100X Pikachu", "a_b", "axb", "c\\d", "cd"];
    await upsertHits(
      db,
      names.map((name, i) =>
        hit({ provider: "fake", providerId: `l${i}`, name }),
      ),
    );
    const opts = { kind: "raw", language: "en" } as const;
    const found = async (q: string) =>
      (await searchCatalog(db, q, opts, provider)).map((r) => r.name);
    expect(await found("100%")).toEqual(["100% Pikachu"]);
    expect(await found("a_")).toEqual(["a_b"]);
    expect(await found("c\\")).toEqual(["c\\d"]);
    expect(provider.search).not.toHaveBeenCalled();
  });

  it("answers a graded search with one raw row per card", async () => {
    const provider = fakeProvider([hit({ providerId: "g1", name: "Gengar" })]);
    const rows = await searchCatalog(
      db,
      "gengar",
      { kind: "graded", language: "en" },
      provider,
    );
    expect(rows.map((r) => [r.kind, r.grader])).toEqual([["raw", null]]);
    expect(provider.search).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "raw" }),
    );
    // The slab row is made when the vendor picks a grade, and reused after.
    const psa = await gradedItem(db, rows[0].id, "PSA", "9");
    expect(psa).toMatchObject({ kind: "graded", grader: "PSA", grade: "9" });
    expect((await gradedItem(db, rows[0].id, "PSA", "9"))?.id).toBe(psa?.id);
    expect(await gradedItem(db, psa!.id, "PSA", "10")).toBeNull();
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
    expect(rows.filter((r) => r.providerId === psa.providerId)).toHaveLength(2);
    for (const bad of [
      hit({ providerId: "x", kind: "graded" }),
      hit({ providerId: "y", grader: "PSA", grade: "10" }),
      hit({ providerId: "z", kind: "graded", grader: "PSA", grade: "11" }),
    ])
      await expect(db.insert(schema.catalogItem).values(bad)).rejects.toThrow();
  });
});

describe("matching and ranking", () => {
  const opts = { kind: "raw", language: "en" } as const;
  const names = async (q: string) =>
    (await searchCached(db, q, opts, "m")).items.map((r) => r.name);

  beforeAll(async () => {
    const card = (
      providerId: string,
      name: string,
      setName: string,
      number: string,
    ) => hit({ provider: "m", providerId, name, setName, number });
    await upsertHits(db, [
      card("1", "Charizard ex", "151", "199/165"),
      card("2", "Charizard", "Base Set", "4/102"),
      card("3", "Mew ex", "151", "205/165"),
      card("4", "Charmander", "Base Set", "46/102"),
      card("5", "Dark Charizard", "Team Rocket", "21/82"),
    ]);
  });

  it.each([
    ["ex charizard", ["Charizard ex"]],
    ["char 199", ["Charizard ex"]],
    ["mew 151", ["Mew ex"]],
    ["151 mew", ["Mew ex"]],
    ["base set charizard", ["Charizard"]],
    ["199/165", ["Charizard ex"]],
    ["0199/0165", ["Charizard ex"]],
    ["charizard 4", ["Charizard"]],
    // Number match, then name starts with a word, then contains.
    ["charizard", ["Charizard", "Charizard ex", "Dark Charizard"]],
    ["char", ["Charizard", "Charizard ex", "Charmander", "Dark Charizard"]],
    ["4 base", ["Charizard"]],
    ["199/999", []],
  ])("finds %j", async (q, want) => expect(await names(q)).toEqual(want));

  it("ranks an exact number over the name, and the name over contains", () => {
    const row = (name: string, number: string | null = null) => ({
      name,
      setName: "Base Set",
      number,
    });
    expect(rank(row("Dark Charizard", "4/102"), "charizard 4")).toBe(0);
    expect(rank(row("Charizard"), "zard charizard")).toBe(1);
    expect(rank(row("Dark Charizard"), "charizard base")).toBe(2);
    expect(rank(row("Lizardon"), "charizard")).toBe(3);
  });

  it("merges one row per id, best rank first, local before provider on ties", () => {
    const [ex, base, dark] = [
      { ...hit(), id: "a", name: "Charizard ex" },
      { ...hit(), id: "b", name: "Charizard", number: "4" },
      { ...hit(), id: "c", name: "Dark Charizard" },
    ] as schema.CatalogItem[];
    const odd = { ...ex, id: "d", name: "Lizardon" };
    expect(
      mergeRows("charizard", [dark, ex], [odd, ex, base]).map((r) => r.id),
    ).toEqual(["a", "b", "c", "d"]);
    expect(mergeRows("charizard 4", [ex], [base]).map((r) => r.id)).toEqual([
      "b",
      "a",
    ]);
  });
});

describe("two-phase search", () => {
  const opts = { kind: "raw", language: "en" } as const;
  const card = (providerId: string, name: string) =>
    hit({ provider: "two", providerId, name, number: providerId });

  it("answers from the cache first, then merges the provider's answer once", async () => {
    await upsertHits(db, [card("10", "Gardevoir ex")]);
    const provider = {
      ...fakeProvider([card("10", "Gardevoir ex"), card("11", "Gardevoir")]),
      name: "two",
    };
    // One cached card no longer hides the rest.
    const first = await searchCached(db, "gardevoir", opts, "two");
    expect(first.items.map((r) => r.name)).toEqual(["Gardevoir ex"]);
    expect(first.answered).toBe(false);
    const fresh = await searchFresh(db, "gardevoir", opts, provider);
    expect(fresh.map((r) => r.name)).toEqual(["Gardevoir", "Gardevoir ex"]);
    // The whole query is answered now: the cache says so and no new call goes out.
    const again = await searchCached(db, "Gardevoir ", opts, "two");
    expect(again.answered).toBe(true);
    expect(again.items.map((r) => r.id)).toEqual(fresh.map((r) => r.id));
    await searchFresh(db, "gardevoir", opts, provider);
    expect(provider.search).toHaveBeenCalledTimes(1);
  });

  it("keeps the cached answer when the hourly limit is reached", async () => {
    await upsertHits(db, [card("20", "Kirlia")]);
    const provider = { ...fakeProvider([]), name: "two" };
    const limit = {
      check: vi.fn(async () => {
        throw new SearchLimitError("limit");
      }),
      record: vi.fn(async () => {}),
    };
    await expect(
      searchFresh(db, "kirlia", opts, provider, limit),
    ).rejects.toBeInstanceOf(SearchLimitError);
    expect(provider.search).not.toHaveBeenCalled();
    expect((await searchCached(db, "kirlia", opts, "two")).items).toHaveLength(
      1,
    );
  });

  it("adds the latest market price", async () => {
    const [row] = await upsertHits(db, [card("30", "Ralts")]);
    await db.insert(schema.pricePoint).values([
      {
        catalogItemId: row.id,
        date: "2026-11-01",
        marketUsd: "1.00",
        source: "two",
      },
      {
        catalogItemId: row.id,
        date: "2026-11-02",
        marketUsd: "1.25",
        source: "two",
      },
    ]);
    const [other] = await upsertHits(db, [card("31", "Ralts")]);
    const priced = await withMarket(db, [row, other]);
    expect(priced.map((r) => r.market)).toEqual(["1.25", null]);
  });
});
