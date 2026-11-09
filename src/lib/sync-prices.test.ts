import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/open";
import * as schema from "@/db/schema";
import { upsertHits } from "@/lib/catalog";
import { PartialPricesError } from "@/lib/pricing/errors";
import type { CatalogHit } from "@/lib/pricing/provider";
import { syncPrices } from "@/lib/sync-prices";
import { addStore, fakeProvider, hit, migratedDb } from "@/lib/test-fixtures";

let db: Db;
let storeId: string;

beforeAll(async () => {
  db = await migratedDb();
  storeId = await addStore(db, "s1");
});

/** Upserts the hits and lists each one in the store. */
async function list(hits: CatalogHit[], active = true, qty = 1) {
  const rows = await upsertHits(db, hits);
  await db.insert(schema.listing).values(
    rows.map((r) => ({
      storeId,
      catalogItemId: r.id,
      kind: r.kind,
      language: r.language,
      condition: r.kind === "raw" ? ("NM" as const) : null,
      active,
      qty,
    })),
  );
  return rows;
}

const only =
  (name: string, price = 10) =>
  (n: string) =>
    n === name ? fakeProvider([], price) : null;

describe("syncPrices", () => {
  it("prices only catalog items behind an active, in-stock listing", async () => {
    await list([hit({ provider: "sel", providerId: "on" })]);
    await list([hit({ provider: "sel", providerId: "off" })], false);
    await list([hit({ provider: "sel", providerId: "sold" })], true, 0);
    await upsertHits(db, [hit({ provider: "sel", providerId: "unlisted" })]);
    const res = await syncPrices(db, "2026-11-01", only("sel"));
    expect(res).toMatchObject({ items: 1, written: 1 });
  });

  it("is idempotent per day and skips providers without an adapter", async () => {
    await list([hit(), hit({ providerId: "b" }), hit({ provider: "nokey" })]);
    const first = await syncPrices(db, "2026-11-08", only("fake", 10));
    const second = await syncPrices(db, "2026-11-08", only("fake", 12.5));
    expect(second).toEqual(first);
    expect(first).toMatchObject({ written: 2, skipped: 2, failed: 0 });
    const points = await db.select().from(schema.pricePoint);
    expect(points.filter((p) => p.marketUsd === "12.50")).toHaveLength(2);
  });

  it("spends maxCalls on the least recently priced items first", async () => {
    // Only "fake" rows compete, so the never-priced one must win the single call.
    await db.execute(
      sql`update listing set active = false where catalog_item_id in (select id from catalog_item where provider <> 'fake')`,
    );
    const [never] = await list([hit({ providerId: "never" })]);
    const res = await syncPrices(db, "2026-11-09", only("fake"), {
      maxCalls: 1,
      maxBackfill: 200,
    });
    expect(res).toMatchObject({ items: 1, written: 1 });
    const fresh = await db.select().from(schema.pricePoint);
    const today = fresh.filter((p) => p.date === "2026-11-09");
    expect(today.map((p) => p.catalogItemId)).toEqual([never.id]);
  });

  it("reports total failure when every call throws", async () => {
    const broken = fakeProvider([]);
    broken.getPrices = async () => {
      throw new Error("down");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await syncPrices(db, "2026-11-10", (n) =>
      n === "fake" ? broken : null,
    );
    expect(res).toMatchObject({ written: 0, failed: 3 });
  });

  it("stops calling a provider after 3 failed chunks in a row", async () => {
    await list(
      Array.from({ length: 80 }, (_, i) =>
        hit({ provider: "many", providerId: `m${i}` }),
      ),
    );
    let calls = 0;
    const broken = fakeProvider([]);
    broken.getPrices = async () => {
      calls++;
      throw new Error("PPT 429");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await syncPrices(db, "2026-11-11", (n) =>
      n === "many" ? broken : null,
    );
    expect(calls).toBe(3);
    expect(res).toMatchObject({ written: 0, failed: 80 });
  });

  it("backfills history once per thin item and never for charted ones", async () => {
    const [thin, full] = await list([
      hit({ provider: "hist", providerId: "thin" }),
      hit({ provider: "hist", providerId: "full" }),
    ]);
    await db.insert(schema.pricePoint).values(
      ["2026-09-01", "2026-09-02", "2026-09-03"].map((date) => ({
        catalogItemId: full.id,
        date,
        marketUsd: "5.00",
        source: "hist",
      })),
    );
    const provider = { ...fakeProvider([]), name: "hist" };
    provider.getHistory = vi.fn(async () => [
      { date: "2026-10-01", marketUsd: 4 },
      { date: "2026-10-15", marketUsd: 4.5 },
    ]);
    const res = await syncPrices(db, "2026-11-12", (n) =>
      n === "hist" ? provider : null,
    );
    expect(provider.getHistory).toHaveBeenCalledTimes(1);
    expect(provider.getHistory).toHaveBeenCalledWith(
      expect.objectContaining({ id: thin.id }),
      90,
    );
    expect(res.backfilled).toBe(1);
    const pts = await db.select().from(schema.pricePoint);
    expect(pts.filter((p) => p.catalogItemId === thin.id)).toHaveLength(3);
  });

  it("caps backfill, charges 2 credits each, skips items that failed to price", async () => {
    await db.execute(sql`update listing set active = false`);
    await list(
      Array.from({ length: 6 }, (_, i) =>
        hit({ provider: "cap", providerId: `c${i}` }),
      ),
    );
    const provider = { ...fakeProvider([]), name: "cap" };
    const asked: string[] = [];
    provider.getHistory = vi.fn(async (ref) => {
      asked.push((ref as { id: string }).id);
      return [];
    });
    const pick = (n: string) => (n === "cap" ? provider : null);
    // 6 credits priced, 4 left: two history calls fit, not three.
    let res = await syncPrices(db, "2026-11-13", pick, {
      maxCalls: 10,
      maxBackfill: 200,
    });
    expect(res.backfilled).toBe(2);
    res = await syncPrices(db, "2026-11-14", pick, {
      maxCalls: 5000,
      maxBackfill: 3,
    });
    expect(res.backfilled).toBe(3);
    // Every price call fails tonight: no history call follows a failed price.
    provider.getPrices = async () => {
      throw new PartialPricesError([], 6, new Error("down"));
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    asked.length = 0;
    res = await syncPrices(db, "2026-11-15", pick);
    expect(res).toMatchObject({ failed: 6, backfilled: 0 });
    expect(asked).toEqual([]);
  });
});
