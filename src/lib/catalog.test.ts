import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/open";
import * as schema from "@/db/schema";
import {
  MISSES_PER_HOUR,
  missLimit,
  parseQuery,
  searchCatalog,
  upsertHits,
} from "@/lib/catalog";
import { SearchBusyError, SearchError } from "@/lib/pricing/errors";
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
