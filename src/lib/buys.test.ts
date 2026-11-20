import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import type { Db } from "@/db/open";
import { buy, buyLine, listing, stockMove, store, till } from "@/db/schema";
import { upsertHits } from "@/lib/catalog";
import { buyInput, recordBuy } from "@/lib/buys";
import { createRequest } from "@/lib/requests";
import { confirmSale, voidSale } from "@/lib/sales";
import { addStore, hit, migratedDb } from "@/lib/test-fixtures";
import { overShort } from "@/lib/format";
import { closeTill, currentTill, openTill, setFloat } from "@/lib/till";

let db: Db;
beforeAll(async () => {
  db = await migratedDb();
});

async function shop(qty = 2, cost: string | null = "10.00") {
  const storeId = await addStore(db, randomUUID().slice(0, 8));
  await db
    .update(store)
    .set({ state: "open", openedAt: new Date() })
    .where(eq(store.id, storeId));
  const [l] = await db
    .insert(listing)
    .values({
      storeId,
      kind: "raw",
      language: "en",
      name: "Mew ex",
      condition: "NM",
      qty,
      cost,
      overridePrice: "30.00",
    })
    .returning({ id: listing.id });
  return { storeId, listingId: l.id };
}

const one = async (id: string) =>
  (await db.select().from(listing).where(eq(listing.id, id)))[0];

const input = (over: { lines: unknown[]; method?: string; seller?: string }) =>
  buyInput.parse({ id: randomUUID(), method: "cash", ...over });

test("a buy adds stock, averages the cost and labels the move", async () => {
  const s = await shop(2, "10.00");
  const b = input({
    seller: "  Sam ",
    lines: [{ listingId: s.listingId, qty: 2, unitPrice: "16" }],
  });
  const r = await recordBuy(db, s.storeId, b);
  expect(r).toEqual({ ok: true, buyId: b.id, total: "32.00", added: [] });
  // Two on hand at $10 and two bought at $16: $13 each.
  expect(await one(s.listingId)).toMatchObject({ qty: 4, cost: "13.00" });
  const [move] = await db
    .select()
    .from(stockMove)
    .where(
      and(eq(stockMove.listingId, s.listingId), eq(stockMove.reason, "bought")),
    );
  expect(move).toMatchObject({ delta: 2, qtyAfter: 4, ref: b.id });
  const [row] = await db.select().from(buy).where(eq(buy.id, b.id));
  expect(row).toMatchObject({ seller: "Sam", method: "cash", total: "32.00" });
  expect(
    await db.select().from(buyLine).where(eq(buyLine.buyId, b.id)),
  ).toMatchObject([{ lineNo: 1, name: "Mew ex", qty: 2, unitPrice: "16.00" }]);
});

test("the price paid becomes the cost when none was known or none is left", async () => {
  const unknown = await shop(3, null);
  await recordBuy(
    db,
    unknown.storeId,
    input({
      lines: [{ listingId: unknown.listingId, qty: 1, unitPrice: "8" }],
    }),
  );
  expect(await one(unknown.listingId)).toMatchObject({ qty: 4, cost: "8.00" });

  const empty = await shop(0, "50.00");
  await recordBuy(
    db,
    empty.storeId,
    input({ lines: [{ listingId: empty.listingId, qty: 1, unitPrice: "20" }] }),
  );
  expect(await one(empty.listingId)).toMatchObject({ qty: 1, cost: "20.00" });
});

test("a new item becomes a listing with the bought units at cost", async () => {
  const s = await shop();
  const b = input({
    method: "trade",
    lines: [
      {
        item: {
          name: "Pikachu promo",
          kind: "raw",
          language: "ja",
          condition: "LP",
        },
        qty: 3,
        unitPrice: "4.50",
      },
    ],
  });
  const r = await recordBuy(db, s.storeId, b);
  if (!("ok" in r)) throw new Error("expected a buy");
  const [line] = await db.select().from(buyLine).where(eq(buyLine.buyId, b.id));
  expect(await one(line.listingId)).toMatchObject({
    name: "Pikachu promo",
    qty: 3,
    cost: "4.50",
    storeId: s.storeId,
  });
  const [move] = await db
    .select()
    .from(stockMove)
    .where(eq(stockMove.listingId, line.listingId));
  expect(move).toMatchObject({ reason: "bought", delta: 3, ref: b.id });
});

test("a catalog card tops up the store's row of that card and condition, or makes one", async () => {
  const s = await shop();
  const [card] = await upsertHits(db, [hit({ providerId: "buy-merge-1" })]);
  const [nm] = await db
    .insert(listing)
    .values({
      storeId: s.storeId,
      catalogItemId: card.id,
      kind: "raw",
      language: "en",
      condition: "NM",
      qty: 2,
      cost: "10.00",
    })
    .returning({ id: listing.id });
  // A hidden row of the same card is left alone, as an add leaves it.
  await db.insert(listing).values({
    storeId: s.storeId,
    catalogItemId: card.id,
    kind: "raw",
    language: "en",
    condition: "NM",
    qty: 5,
    active: false,
  });
  const b = input({
    lines: [
      { catalogItemId: card.id, condition: "NM", qty: 2, unitPrice: "16" },
      { catalogItemId: card.id, condition: "LP", qty: 1, unitPrice: "5" },
    ],
  });
  const r = await recordBuy(db, s.storeId, b);
  expect(r).toMatchObject({ ok: true, total: "37.00", added: [card.id] });
  expect(await one(nm.id)).toMatchObject({ qty: 4, cost: "13.00" });
  const lines = await db.select().from(buyLine).where(eq(buyLine.buyId, b.id));
  expect(lines.map((l) => l.name)).toEqual(["Charizard ex", "Charizard ex"]);
  expect(lines[0].listingId).toBe(nm.id);
  // The LP copy is a new row with the catalog's kind and language, at cost.
  expect(await one(lines[1].listingId)).toMatchObject({
    catalogItemId: card.id,
    condition: "LP",
    name: null,
    qty: 1,
    cost: "5.00",
  });
  const moves = await db
    .select()
    .from(stockMove)
    .where(eq(stockMove.ref, b.id));
  expect(moves.map((m) => [m.reason, m.delta]).sort()).toEqual([
    ["bought", 1],
    ["bought", 2],
  ]);
  // A raw card needs a condition, as in the add panel.
  await expect(
    recordBuy(
      db,
      s.storeId,
      input({ lines: [{ catalogItemId: card.id, qty: 1, unitPrice: "1" }] }),
    ),
  ).rejects.toThrow(/condition/);
});

test("a double tap records one buy and adds stock once", async () => {
  const s = await shop(1);
  const b = input({
    lines: [{ listingId: s.listingId, qty: 1, unitPrice: "10" }],
  });
  const results = await Promise.all([
    recordBuy(db, s.storeId, b),
    recordBuy(db, s.storeId, b),
  ]);
  expect(results.filter((x) => "already" in x)).toHaveLength(1);
  expect((await one(s.listingId)).qty).toBe(2);
});

test("another store's listing or buy id is refused and nothing changes", async () => {
  const mine = await shop(1);
  const other = await shop(1);
  const b = input({
    lines: [{ listingId: other.listingId, qty: 1, unitPrice: "10" }],
  });
  expect(await recordBuy(db, mine.storeId, b)).toEqual({ gone: true });
  expect((await one(other.listingId)).qty).toBe(1);
  expect(await db.select().from(buy).where(eq(buy.id, b.id))).toHaveLength(0);

  // The same id replayed against another store never reads as that store's.
  const ok = input({
    lines: [{ listingId: mine.listingId, qty: 1, unitPrice: "5" }],
  });
  await recordBuy(db, mine.storeId, ok);
  expect(await recordBuy(db, other.storeId, ok)).toEqual({ gone: true });
});

test("a buy that would pass 9999 units changes nothing", async () => {
  const s = await shop(9999);
  const b = input({
    lines: [{ listingId: s.listingId, qty: 1, unitPrice: "1" }],
  });
  expect(await recordBuy(db, s.storeId, b)).toEqual({ full: [s.listingId] });
  expect(await db.select().from(buy).where(eq(buy.id, b.id))).toHaveLength(0);
});

test("the same listing twice and a zero price are refused", () => {
  const id = randomUUID();
  expect(
    buyInput.safeParse({
      id: randomUUID(),
      method: "cash",
      lines: [
        { listingId: id, qty: 1, unitPrice: "1" },
        { listingId: id, qty: 1, unitPrice: "1" },
      ],
    }).success,
  ).toBe(false);
  expect(
    buyInput.safeParse({
      id: randomUUID(),
      method: "cash",
      lines: [{ listingId: id, qty: 1, unitPrice: "0" }],
    }).success,
  ).toBe(false);
});

async function cashSale(
  s: { storeId: string; listingId: string },
  method: "cash" | "card" = "cash",
) {
  const r = await createRequest(db, {
    storeId: s.storeId,
    lines: [{ listingId: s.listingId, qty: 1 }],
    buyerName: "Maya",
    buyerEmail: "maya@example.test",
    promo: false,
    sessionId: randomUUID(),
    ipHash: null,
    holdMs: 15 * 60_000,
  });
  if (!r.ok) throw new Error("request failed");
  const sold = await confirmSale(db, s.storeId, {
    requestId: r.id,
    lines: [{ listingId: s.listingId, qty: 1, unitPrice: "30" }],
    discount: { kind: "none" },
    method,
  });
  if (!("ok" in sold)) throw new Error("expected a sale");
  return sold.saleId;
}

test("expected cash is the float plus cash sales, less voids and cash buys", async () => {
  const s = await shop(5);
  await openTill(db, s.storeId);
  await openTill(db, s.storeId); // a second open keeps the first box
  await setFloat(db, s.storeId, "100.00");
  await cashSale(s);
  const voidedId = await cashSale(s);
  await voidSale(db, s.storeId, voidedId, { restock: true });
  await cashSale(s, "card");
  await recordBuy(
    db,
    s.storeId,
    input({ lines: [{ listingId: s.listingId, qty: 1, unitPrice: "12.50" }] }),
  );
  // A trade-in moves no cash.
  await recordBuy(
    db,
    s.storeId,
    input({
      method: "trade",
      lines: [{ listingId: s.listingId, qty: 1, unitPrice: "20" }],
    }),
  );
  const open = await currentTill(db, s.storeId);
  expect(open).toMatchObject({
    float: "100.00",
    cashSales: "30.00",
    cashBuys: "12.50",
    expected: "117.50",
  });

  // Counted $115, $2.50 short; a second tap returns the first check.
  const [a, b] = await Promise.all([
    closeTill(db, s.storeId, open!.id, "115.00"),
    closeTill(db, s.storeId, open!.id, "999.00"),
  ]);
  expect([a, b].filter((x) => "already" in x)).toHaveLength(1);
  if (!("ok" in a)) throw new Error("expected a check");
  expect(a).toMatchObject({ expected: "117.50", counted: "115.00" });
  expect(overShort(a.counted, a.expected)).toBe("$2.50 short");
  expect(overShort("1.00", "0.50")).toBe("$0.50 over");
  expect(overShort("0.10", "0.1")).toBe("Right on");
  expect(await currentTill(db, s.storeId)).toBeNull();

  // Another store can't close or read this box.
  const other = await shop();
  expect(await closeTill(db, other.storeId, open!.id, "1.00")).toEqual({
    gone: true,
  });
  const rows = await db.select().from(till).where(eq(till.storeId, s.storeId));
  expect(rows).toHaveLength(1);
});
