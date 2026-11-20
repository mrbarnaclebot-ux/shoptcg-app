import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/open";
import * as schema from "@/db/schema";
import { upsertHits } from "@/lib/catalog";
import { createEvent, endEvent } from "@/lib/claim-events";
import { syncBasket } from "@/lib/floor";
import { toCsv } from "@/lib/csv";
import { CSV_COLUMNS, readCsv } from "@/lib/csv-import";
import { customListingSchema } from "@/lib/listing-input";
import {
  addCatalogListing,
  addCustomListing,
  importListings,
  listStock,
  ListingError,
  MAX_ACTIVE_LISTINGS,
  removeListings,
  restoreListings,
  setActive,
  setPrices,
  stockCsvRows,
  stockValue,
  countStock,
  stepQty,
  updateListing,
} from "@/lib/listings";
import { buyerRequest } from "@/lib/request-reads";
import { createRequest } from "@/lib/requests";
import { publicItemExists } from "@/lib/storefront";
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
      /can show 5,000 items/,
    );
    // Removed and hidden items don't count.
    const [one] = await listStock(db, full);
    await removeListings(db, full, [one.id], false);
    expect(await addCustomListing(db, full, custom())).toBeTruthy();
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
    // The same slab again tops up the first listing.
    expect(two).toEqual({ id: one.id, catalogItemId: one.catalogItemId });
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

const moves = (id: string) =>
  db
    .select({
      reason: schema.stockMove.reason,
      delta: schema.stockMove.delta,
      qtyAfter: schema.stockMove.qtyAfter,
    })
    .from(schema.stockMove)
    .where(eq(schema.stockMove.listingId, id))
    .orderBy(schema.stockMove.at);

const newStore = () => addStore(db, randomUUID().slice(0, 8));

async function openStore(mode: "table" | "online" = "table") {
  const id = await newStore();
  await db
    .update(schema.store)
    .set({ state: "open", openedAt: new Date(), sellingMode: mode })
    .where(eq(schema.store.id, id));
  return id;
}

const item = (storeId: string, name: string, qty = 2) =>
  addCustomListing(db, storeId, custom({ name, qty, overridePrice: "10.00" }));

async function send(storeId: string, ids: string[]) {
  const r = await createRequest(db, {
    storeId,
    lines: ids.map((listingId) => ({ listingId, qty: 1 })),
    buyerName: "Maya Robinson",
    buyerEmail: "maya@example.test",
    promo: false,
    sessionId: randomUUID(),
    ipHash: null,
    holdMs: 15 * 60_000,
  });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r.id;
}

describe("remove and restore", () => {
  it("takes the quantity to 0 and restore puts it back, both in the ledger", async () => {
    const s = await newStore();
    const l = await item(s, "Ledger card", 3);
    expect(await removeListings(db, s, [l.id], false)).toEqual({
      ok: true,
      names: ["Ledger card"],
    });
    expect((await listStock(db, s)).map((r) => r.id)).not.toContain(l.id);
    expect(await listStock(db, s, { kind: "hidden" })).toHaveLength(0);
    const [row] = await listStock(db, s, { kind: "removed" });
    expect(row).toMatchObject({ id: l.id, qty: 0 });
    // Removed stock can't be stepped, edited or removed again.
    expect(await stepQty(db, s, l.id, 1)).toBeNull();
    expect(await updateListing(db, s, { id: l.id, qty: 5 })).toBe(false);
    expect(await removeListings(db, s, [l.id], false)).toEqual({ gone: true });

    expect(await restoreListings(db, s, [l.id])).toBe(1);
    expect(await restoreListings(db, s, [l.id])).toBe(0);
    expect((await listStock(db, s, { id: l.id }))[0]).toMatchObject({
      qty: 3,
      removedAt: null,
    });
    expect(await moves(l.id)).toEqual([
      { reason: "added", delta: 3, qtyAfter: 3 },
      { reason: "removed", delta: -3, qtyAfter: 0 },
      { reason: "restored", delta: 3, qtyAfter: 3 },
    ]);

    // Sold out, then removed: a restore brings back none, not the older 3.
    await updateListing(db, s, { id: l.id, qty: 0 });
    await removeListings(db, s, [l.id], false);
    await restoreListings(db, s, [l.id]);
    expect((await listStock(db, s, { id: l.id }))[0].qty).toBe(0);
  });

  it("brings a hidden item back hidden", async () => {
    const s = await newStore();
    const l = await item(s, "Hidden card");
    await updateListing(db, s, { id: l.id, active: false });
    await removeListings(db, s, [l.id], false);
    await restoreListings(db, s, [l.id]);
    const hidden = await listStock(db, s, { kind: "hidden" });
    expect(hidden.map((r) => r.id)).toEqual([l.id]);
  });

  it("takes it off buyers' requests and carts, closing a request left empty", async () => {
    const s = await openStore();
    const gone = await item(s, "Umbreon promo");
    const kept = await item(s, "Espeon promo");
    const both = await send(s, [gone.id, kept.id]);
    const only = await send(s, [gone.id]);
    const device = "d".repeat(32);
    await syncBasket(db, s, device, [
      { id: gone.id, qty: 1 },
      { id: kept.id, qty: 1 },
    ]);
    // Asked first: two requests and a cart hold it, and nothing changed yet.
    expect(await removeListings(db, s, [gone.id], false)).toEqual({ held: 3 });
    expect(await listStock(db, s, { kind: "removed" })).toHaveLength(0);

    expect(await removeListings(db, s, [gone.id], true)).toMatchObject({
      ok: true,
    });
    const sid = async (id: string) =>
      (
        await db
          .select({ sessionId: schema.request.sessionId })
          .from(schema.request)
          .where(eq(schema.request.id, id))
      )[0].sessionId;
    const left = await buyerRequest(db, both, await sid(both));
    expect(left).toMatchObject({
      status: "pending",
      removedItems: ["Umbreon promo"],
    });
    expect(left!.lines.map((l) => l.listingId)).toEqual([kept.id]);
    // Its only item gone: closed like a decline.
    expect(await buyerRequest(db, only, await sid(only))).toMatchObject({
      status: "declined",
      removedItems: ["Umbreon promo"],
      lines: [],
    });
    const [cart] = await db
      .select({ lines: schema.basket.lines })
      .from(schema.basket)
      .where(
        and(eq(schema.basket.storeId, s), eq(schema.basket.deviceId, device)),
      );
    expect(cart.lines).toEqual([{ id: kept.id, qty: 1 }]);
    expect(await publicItemExists(db, s, gone.id)).toBe(false);
    expect(await publicItemExists(db, s, kept.id)).toBe(true);
  });

  it("waits for a claim event to end", async () => {
    const s = await openStore("online");
    const l = await item(s, "Event box", 1);
    const ev = await createEvent(db, s, {
      title: "Friday drop",
      startsAt: new Date(Date.now() + 60_000),
      endsAt: new Date(Date.now() + 3_600_000),
      priceMode: "market",
      allowUnclaim: false,
      payWithinHours: 24,
      maxPerBuyer: 5,
      items: [{ listingId: l.id, price: null, maxPerBuyer: 1 }],
    });
    if (!("ok" in ev)) throw new Error(ev.error);
    expect(await removeListings(db, s, [l.id], true)).toEqual({
      event: "Friday drop",
    });
    // Hiding is still allowed.
    expect(await updateListing(db, s, { id: l.id, active: false })).toBe(true);
    await endEvent(db, s, ev.id);
    expect(await removeListings(db, s, [l.id], false)).toMatchObject({
      ok: true,
    });
  });
});

describe("adding a card you already have", () => {
  const add = (
    storeId: string,
    catalogItemId: string,
    over: Partial<Parameters<typeof addCatalogListing>[2]> = {},
  ) =>
    addCatalogListing(db, storeId, {
      catalogItemId,
      grader: null,
      grade: null,
      condition: "NM",
      qty: 1,
      overridePrice: null,
      cost: null,
      ...over,
    });
  const card = async (providerId: string) =>
    (await upsertHits(db, [hit({ providerId })]))[0];

  it("tops up the same card and condition, blending the cost", async () => {
    const s = await newStore();
    const { id } = await card("merge-1");
    const first = await add(s, id, { qty: 2, cost: "10.00" });
    expect(first.merged).toBeNull();
    expect(
      await add(s, id, { qty: 2, cost: "20.00", overridePrice: "30.00" }),
    ).toMatchObject({
      id: first.id,
      qty: 4,
      cost: "15.00",
      overridePrice: "30.00",
      merged: { from: 2, to: 4 },
    });
    // No cost or price this time: both stay.
    expect(await add(s, id)).toMatchObject({
      id: first.id,
      qty: 5,
      cost: "15.00",
      overridePrice: "30.00",
    });
    expect((await moves(first.id)).at(-1)).toEqual({
      reason: "added",
      delta: 1,
      qtyAfter: 5,
    });
    // Another condition, or the card hidden, gets its own row.
    expect((await add(s, id, { condition: "LP" })).id).not.toBe(first.id);
    await updateListing(db, s, { id: first.id, active: false });
    expect((await add(s, id)).id).not.toBe(first.id);
  });

  it("won't pass 9999 on one listing", async () => {
    const s = await newStore();
    const { id } = await card("merge-max");
    await add(s, id, { qty: 9999 });
    await expect(add(s, id)).rejects.toThrow(ListingError);
  });

  it("imports catalog rows onto cards in stock and onto each other, never custom rows", async () => {
    const s = await newStore();
    const [zard, mew] = [await card("merge-2"), await card("merge-3")];
    const have = await add(s, zard.id);
    const row = (catalogItemId: string, qty: number) => ({
      kind: "catalog" as const,
      input: {
        catalogItemId,
        grader: null,
        grade: null,
        condition: "NM" as const,
        qty,
        overridePrice: null,
        cost: null,
      },
    });
    const own = { kind: "custom" as const, input: custom() };
    await importListings(db, s, [
      row(zard.id, 2),
      row(mew.id, 1),
      row(mew.id, 3),
      own,
      own,
    ]);
    const stock = await listStock(db, s);
    expect(stock).toHaveLength(4);
    expect(stock.find((r) => r.id === have.id)!.qty).toBe(3);
    expect(stock.find((r) => r.catalogItemId === mew.id)!.qty).toBe(4);
    expect(stock.filter((r) => r.catalogItemId === null)).toHaveLength(2);
  });
});

describe("finding stock", () => {
  const names = async (storeId: string, f: Parameters<typeof listStock>[2]) =>
    (await listStock(db, storeId, f)).map((r) => r.name);

  it("matches every word, in any order, across name, set and number", async () => {
    const s = await newStore();
    const [zard] = await upsertHits(db, [hit({ providerId: "find-1" })]);
    await addCatalogListing(db, s, {
      catalogItemId: zard.id,
      grader: null,
      grade: null,
      condition: "NM",
      qty: 1,
      overridePrice: null,
      cost: null,
    });
    await addCustomListing(
      db,
      s,
      custom({ name: "Pikachu Gold Star", setName: "Promo", number: "SM-P 1" }),
    );
    const zardOnly = ["Charizard ex"];
    expect(await names(s, { q: "151 charizard" })).toEqual(zardOnly);
    expect(await names(s, { q: "ex 199" })).toEqual(zardOnly);
    expect(await names(s, { q: "CHAR   151" })).toEqual(zardOnly);
    expect(await names(s, { q: "star sm-p" })).toEqual(["Pikachu Gold Star"]);
    expect(await names(s, { q: "promo gold" })).toEqual(["Pikachu Gold Star"]);
    expect(await names(s, { q: "charizard promo" })).toEqual([]);
    // LIKE's wildcards are plain characters.
    expect(await names(s, { q: "%" })).toEqual([]);
  });

  it("sorts by name, quantity and the price buyers see, across pages", async () => {
    const s = await newStore();
    // Round to whole dollars, 10% over market: the order must follow that price.
    await db
      .update(schema.store)
      .set({ priceRulePct: 10, rounding: "1" })
      .where(eq(schema.store.id, s));
    const [c] = await upsertHits(db, [hit({ providerId: "sort-1" })]);
    await db.insert(schema.pricePoint).values({
      catalogItemId: c.id,
      date: "2026-11-01",
      marketUsd: "9.40", // 10.34, so $10
      source: "fake",
    });
    await addCatalogListing(db, s, {
      catalogItemId: c.id,
      grader: null,
      grade: null,
      condition: "NM",
      qty: 5,
      overridePrice: null,
      cost: null,
    });
    await item(s, "Beedrill", 1); // fixed $10.00
    await addCustomListing(db, s, custom({ name: "Abra", qty: 9 })); // no price
    await addCustomListing(
      db,
      s,
      custom({ name: "Dratini", qty: 2, overridePrice: "10.50" }),
    );
    expect(await names(s, { sort: "name" })).toEqual([
      "Abra",
      "Beedrill",
      "Charizard ex",
      "Dratini",
    ]);
    expect(await names(s, { sort: "qty" })).toEqual([
      "Abra",
      "Charizard ex",
      "Dratini",
      "Beedrill",
    ]);
    // Ties ($10 each) fall back to newest first; unpriced is last both ways.
    expect(await names(s, { sort: "price-desc" })).toEqual([
      "Dratini",
      "Beedrill",
      "Charizard ex",
      "Abra",
    ]);
    expect(await names(s, { sort: "price-asc" })).toEqual([
      "Beedrill",
      "Charizard ex",
      "Dratini",
      "Abra",
    ]);
    expect(await countStock(db, s, {})).toBe(4);
    expect(await countStock(db, s, { q: "dratini" })).toBe(1);
    expect(await listStock(db, s, { page: 2 })).toEqual([]);
  });
});

describe("bulk", () => {
  it("hides and shows several at once, never removed ones", async () => {
    const s = await newStore();
    const [x, y, z] = [
      await item(s, "Bulk x"),
      await item(s, "Bulk y"),
      await item(s, "Bulk z"),
    ];
    await removeListings(db, s, [z.id], false);
    expect(await setActive(db, s, [x.id, y.id, z.id], false)).toBe(2);
    expect(await listStock(db, s, { kind: "hidden" })).toHaveLength(2);
    expect(await setActive(db, s, [x.id, y.id], true)).toBe(2);
    expect(await listStock(db, s)).toHaveLength(2);
    // Another store's ids change nothing.
    expect(await setActive(db, a, [x.id], false)).toBe(0);
  });

  it("removes several, asking once for every buyer holding any, then restores them", async () => {
    const s = await openStore();
    const [x, y, z] = [
      await item(s, "Bulk Abra"),
      await item(s, "Bulk Kadabra"),
      await item(s, "Bulk Alakazam"),
    ];
    const r = await send(s, [x.id, y.id, z.id]);
    // One request holds two of them: that is one buyer.
    expect(await removeListings(db, s, [x.id, y.id], false)).toEqual({
      held: 1,
    });
    expect(await removeListings(db, s, [x.id, y.id], true)).toMatchObject({
      ok: true,
      names: expect.arrayContaining(["Bulk Abra", "Bulk Kadabra"]),
    });
    const [left] = await db
      .select({
        removedItems: schema.request.removedItems,
        status: schema.request.status,
      })
      .from(schema.request)
      .where(eq(schema.request.id, r));
    expect(left.status).toBe("pending");
    expect([...left.removedItems].sort()).toEqual([
      "Bulk Abra",
      "Bulk Kadabra",
    ]);
    expect(await listStock(db, s, { kind: "removed" })).toHaveLength(2);
    expect(await restoreListings(db, s, [x.id, y.id, z.id])).toBe(2);
    expect((await listStock(db, s)).map((l) => l.qty)).toEqual([2, 2, 2]);
  });
});

describe("export", () => {
  it("writes rows Import CSV reads back as the same items", async () => {
    const s = await newStore();
    await addCustomListing(
      db,
      s,
      custom({
        name: "Pikachu, Gold Star",
        setName: "Promo",
        number: "SM-P 1",
        qty: 3,
        overridePrice: "25.00",
        cost: "12.50",
      }),
    );
    await addCustomListing(
      db,
      s,
      custom({
        name: "Booster box",
        kind: "sealed",
        language: "en",
        condition: null,
      }),
    );
    const gone = await item(s, "Gone card");
    await removeListings(db, s, [gone.id], false);
    // Hidden stock goes out marked and comes back hidden.
    const [box] = (await listStock(db, s)).filter(
      (l) => l.name === "Booster box",
    );
    await setActive(db, s, [box.id], false);
    const rows = await stockCsvRows(db, s);
    expect(rows[0]).toEqual([...CSV_COLUMNS, "hidden"]);
    const back = readCsv(toCsv(rows).slice(1));
    expect(back).toEqual([
      {
        line: 2,
        ok: true,
        input: expect.objectContaining({
          name: "Pikachu, Gold Star",
          setName: "Promo",
          number: "SM-P 1",
          language: "zh",
          kind: "raw",
          condition: "NM",
          qty: 3,
          overridePrice: "25.00",
          cost: "12.50",
          active: true,
        }),
      },
      {
        line: 3,
        ok: true,
        input: expect.objectContaining({
          name: "Booster box",
          kind: "sealed",
          condition: null,
          qty: 1,
          overridePrice: null,
          active: false,
        }),
      },
    ]);
  });
});

describe("back office", () => {
  it("a typed lower count carries its reason into the ledger", async () => {
    const s = await newStore();
    const l = await item(s, "Dinged card", 5);
    await updateListing(db, s, { id: l.id, qty: 4, reason: "damaged" });
    await updateListing(db, s, { id: l.id, qty: 2, reason: "counted" });
    await updateListing(db, s, { id: l.id, qty: 1 });
    expect(await moves(l.id)).toEqual([
      { reason: "added", delta: 5, qtyAfter: 5 },
      { reason: "damaged", delta: -1, qtyAfter: 4 },
      { reason: "counted", delta: -2, qtyAfter: 2 },
      { reason: "adjusted", delta: -1, qtyAfter: 1 },
    ]);
  });

  it("sets one fixed price on many, or puts them back on the market", async () => {
    const s = await newStore();
    const x = await item(s, "Bulk one");
    const y = await item(s, "Bulk two");
    const gone = await item(s, "Bulk gone");
    await removeListings(db, s, [gone.id], false);
    const other = await item(await newStore(), "Not theirs");
    expect(
      await setPrices(db, s, [x.id, y.id, gone.id, other.id], "4.50"),
    ).toBe(2);
    const price = async (id: string) =>
      (
        await db
          .select({ p: schema.listing.overridePrice })
          .from(schema.listing)
          .where(eq(schema.listing.id, id))
      )[0].p;
    expect([await price(x.id), await price(y.id)]).toEqual(["4.50", "4.50"]);
    expect(await price(other.id)).toBe("10.00");
    expect(await setPrices(db, s, [x.id], null)).toBe(1);
    expect(await price(x.id)).toBeNull();
  });

  it("values every unit held, hidden included, removed and sold out not", async () => {
    const s = await newStore();
    await addCustomListing(db, s, custom({ name: "A", qty: 3, cost: "2.00" }));
    const hidden = await addCustomListing(db, s, custom({ name: "B", qty: 2 }));
    await setActive(db, s, [hidden.id], false);
    const gone = await item(s, "C", 4);
    await removeListings(db, s, [gone.id], false);
    await addCustomListing(db, s, custom({ name: "D", qty: 0, cost: "9.00" }));
    expect(await stockValue(db, s)).toEqual({
      units: 5,
      lines: 2,
      atCost: 6,
      uncostedUnits: 2,
      atMarket: 0,
    });
  });
});

// CI sets DATABASE_URL to a real Postgres, where two adds truly overlap.
const url = process.env.DATABASE_URL;
describe.runIf(Boolean(url))("concurrent adds (Postgres)", () => {
  it("two adds of one card at once make one row", async () => {
    const pg = drizzle(postgres(url!, { max: 4, onnotice: () => {} }), {
      schema,
    });
    await migrate(pg, { migrationsFolder: "drizzle" });
    const conn = pg as unknown as Db;
    const s = await addStore(conn, randomUUID().slice(0, 8));
    const [c] = await upsertHits(conn, [
      hit({ providerId: `race-${randomUUID()}` }),
    ]);
    const input = {
      catalogItemId: c.id,
      grader: null,
      grade: null,
      condition: "NM" as const,
      qty: 1,
      overridePrice: null,
      cost: null,
    };
    const [x, y] = await Promise.all([
      addCatalogListing(conn, s, input),
      addCatalogListing(conn, s, input),
    ]);
    expect(x.id).toBe(y.id);
    const rows = await conn
      .select({ qty: schema.listing.qty })
      .from(schema.listing)
      .where(eq(schema.listing.storeId, s))
      .orderBy(desc(schema.listing.createdAt));
    expect(rows).toEqual([{ qty: 2 }]);
  });
});
