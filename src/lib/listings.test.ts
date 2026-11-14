import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/open";
import * as schema from "@/db/schema";
import { upsertHits } from "@/lib/catalog";
import { customListingSchema } from "@/lib/listing-input";
import {
  addCatalogListing,
  addCustomListing,
  importListings,
  listStock,
  ListingError,
  MAX_ACTIVE_LISTINGS,
  stepQty,
  updateListing,
} from "@/lib/listings";
import { addStore, hit, migratedDb } from "@/lib/test-fixtures";

let db: Db;
let a: string;
let b: string;

beforeAll(async () => {
  db = await migratedDb();
  a = await addStore(db, "va");
  b = await addStore(db, "vb");
});

const custom = (over: Record<string, unknown> = {}) =>
  customListingSchema.parse({
    name: "Pikachu CN promo",
    kind: "raw",
    language: "zh",
    condition: "NM",
    ...over,
  });

describe("ownership", () => {
  it("vendor A cannot edit, step or see vendor B's listing", async () => {
    const theirs = await addCustomListing(db, b, custom({ qty: 2 }));
    expect(await updateListing(db, a, { id: theirs.id, qty: 99 })).toBe(false);
    expect(await stepQty(db, a, theirs.id, 5)).toBeNull();
    expect(await listStock(db, a)).toHaveLength(0);
    const [row] = await db
      .select()
      .from(schema.listing)
      .where(eq(schema.listing.id, theirs.id));
    expect(row.qty).toBe(2);
    expect(await updateListing(db, b, { id: theirs.id, qty: 3 })).toBe(true);
  });
});

describe("listings", () => {
  it("shows catalog fields and the latest market price", async () => {
    const [item] = await upsertHits(db, [hit({ imageUrl: null })]);
    await db.insert(schema.pricePoint).values([
      {
        catalogItemId: item.id,
        date: "2026-11-01",
        marketUsd: "40.00",
        source: "fake",
      },
      {
        catalogItemId: item.id,
        date: "2026-11-07",
        marketUsd: "48.10",
        source: "fake",
      },
    ]);
    await addCatalogListing(db, a, {
      catalogItemId: item.id,
      grader: null,
      grade: null,
      condition: "LP",
      qty: 3,
      overridePrice: null,
      cost: null,
    });
    const [row] = await listStock(db, a, { q: "chari" });
    expect(row).toMatchObject({
      name: "Charizard ex",
      setName: "151",
      kind: "raw",
      condition: "LP",
      // LP is 85% of the Near Mint market by default.
      market: 40.89,
      nmMarket: 48.1,
      conditionPct: 85,
      asOf: "2026-11-07",
    });
    // The store sets the share; NM itself is never discounted.
    await db
      .update(schema.store)
      .set({ condLpPct: 50 })
      .where(eq(schema.store.id, a));
    expect((await listStock(db, a, { q: "chari" }))[0].market).toBe(24.05);
    expect(await listStock(db, a, { kind: "sealed" })).toHaveLength(0);
    expect(await listStock(db, a, { language: "ja" })).toHaveLength(0);
  });

  it("requires a condition for raw catalog items", async () => {
    const [item] = await upsertHits(db, [hit({ providerId: "x2" })]);
    await expect(
      addCatalogListing(db, a, {
        catalogItemId: item.id,
        grader: null,
        grade: null,
        condition: null,
        qty: 1,
        overridePrice: null,
        cost: null,
      }),
    ).rejects.toThrow(ListingError);
  });

  it("never steps qty below 0 and hides from the default view", async () => {
    const row = await addCustomListing(db, a, custom({ qty: 1 }));
    expect(await stepQty(db, a, row.id, -5)).toBe(0);
    await updateListing(db, a, { id: row.id, qty: 9999 });
    expect(await stepQty(db, a, row.id, 1)).toBe(9999);
    await updateListing(db, a, { id: row.id, active: false });
    const hidden = await listStock(db, a, { kind: "hidden" });
    expect(hidden.map((r) => r.id)).toContain(row.id);
    const shown = await listStock(db, a);
    expect(shown.map((r) => r.id)).not.toContain(row.id);
  });

  it("caps active listings per store", async () => {
    const full = await addStore(db, "vfull");
    await db.execute(
      sql`insert into listing (store_id, kind, language, name, condition)
        select ${full}, 'raw', 'en', 'x', 'NM' from generate_series(1, ${MAX_ACTIVE_LISTINGS})`,
    );
    await expect(addCustomListing(db, full, custom())).rejects.toThrow(
      /can list 5000/,
    );
  });

  it("lists a raw card as a slab, making one graded catalog row per grade", async () => {
    const [card] = await upsertHits(db, [hit({ providerId: "slab-1" })]);
    const slab = {
      catalogItemId: card.id,
      grader: "PSA" as const,
      grade: "10",
      condition: null,
      qty: 1,
      overridePrice: null,
      cost: null,
    };
    const one = await addCatalogListing(db, a, slab);
    const [two] = await importListings(db, a, [
      { kind: "catalog", input: slab },
    ]);
    expect(one.catalogItemId).not.toBe(card.id);
    expect(two.catalogItemId).toBe(one.catalogItemId);
    expect(one).toMatchObject({ kind: "graded", condition: null });
    const [row] = await listStock(db, a, { id: one.id });
    expect(row).toMatchObject({ grader: "PSA", grade: "10", name: card.name });
  });

  it("imports all rows or none", async () => {
    const before = (await listStock(db, a)).length;
    const good = { kind: "custom" as const, input: custom() };
    expect(await importListings(db, a, [good, good])).toHaveLength(2);
    const bad = {
      kind: "catalog" as const,
      input: {
        catalogItemId: "00000000-0000-4000-8000-000000000000",
        grader: null,
        grade: null,
        condition: null,
        qty: 1,
        overridePrice: null,
        cost: null,
      },
    };
    await expect(importListings(db, a, [good, bad])).rejects.toThrow();
    expect(await listStock(db, a)).toHaveLength(before + 2);
  });

  it.each([
    { kind: "sealed", condition: "NM" },
    { kind: "raw", condition: null },
    { qty: -1 },
    { overridePrice: "0" },
    { name: " ", catalogItemId: null },
    { kind: "graded", grader: null, grade: null },
  ])("the database rejects %j", async (over) => {
    const base = {
      storeId: a,
      kind: "raw" as const,
      language: "en" as const,
      name: "X",
      condition: "NM" as const,
    };
    await expect(
      db.insert(schema.listing).values({ ...base, ...over } as typeof base),
    ).rejects.toThrow();
  });
});
