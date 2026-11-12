import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { beforeAll, describe, expect, test } from "vitest";
import type { Db } from "@/db/open";
import * as schema from "@/db/schema";
import {
  customer,
  listing,
  receiptEmail,
  request,
  sale,
  saleLine,
  saleVoid,
  stockMove,
  store,
  user,
} from "@/db/schema";
import {
  dayStart,
  heldByListing,
  postgresZone,
  storeQueue,
  waitingCount,
} from "@/lib/request-reads";
import {
  addToTableSale,
  createRequest,
  tableSale,
  type NewRequest,
} from "@/lib/requests";
import {
  confirmSale,
  optOut,
  saleWithLines,
  salesToday,
  voidSale,
  type ConfirmInput,
} from "@/lib/sales";
import { addStore, migratedDb } from "@/lib/test-fixtures";

async function shop(db: Db, qty = 3, price = "10.00") {
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
      overridePrice: price,
    })
    .returning({ id: listing.id });
  return { storeId, listingId: l.id };
}

type Shop = Awaited<ReturnType<typeof shop>>;

async function ask(db: Db, s: Shop, over: Partial<NewRequest> = {}, qty = 1) {
  const r = await createRequest(db, {
    storeId: s.storeId,
    lines: [{ listingId: s.listingId, qty }],
    buyerName: "Maya Robinson",
    buyerEmail: "maya@example.test",
    promo: false,
    sessionId: randomUUID(),
    ipHash: null,
    holdMs: 15 * 60_000,
    ...over,
  });
  if (!r.ok) throw new Error(`request failed: ${JSON.stringify(r)}`);
  return r.id;
}

const lapse = (db: Db, id: string) =>
  db
    .update(request)
    .set({
      expiresAt: sql`now() - interval '1 second'`,
      createdAt: sql`now() - interval '1 minute'`,
    })
    .where(eq(request.id, id));

const input = (
  s: Shop,
  requestId: string,
  over: Partial<ConfirmInput> = {},
  qty = 1,
): ConfirmInput => ({
  requestId,
  lines: [{ listingId: s.listingId, qty, unitPrice: "10" }],
  discount: { kind: "none" },
  method: "cash",
  ...over,
});

const qtyOf = async (db: Db, id: string) =>
  (await db.select().from(listing).where(eq(listing.id, id)))[0].qty;

const salesOf = (db: Db, storeId: string) =>
  db.select().from(sale).where(eq(sale.storeId, storeId));

function suite(name: string, open: () => Promise<Db>) {
  describe(name, () => {
    let db: Db;
    beforeAll(async () => {
      db = await open();
    });

    test("two confirms race for the last copy: one sale, stock at 0", async () => {
      const s = await shop(db, 1);
      // Both holds lapsed, so neither protects the copy and both may try.
      const a = await ask(db, s);
      await lapse(db, a);
      const b = await ask(db, s);
      await lapse(db, b);
      const results = await Promise.all([
        confirmSale(db, s.storeId, input(s, a)),
        confirmSale(db, s.storeId, input(s, b)),
      ]);
      expect(results.filter((r) => "ok" in r)).toHaveLength(1);
      expect(results.filter((r) => "stock" in r)).toHaveLength(1);
      expect(await qtyOf(db, s.listingId)).toBe(0);
    });

    test("a table sale holds stock, sells without an email and sends no receipt", async () => {
      const s = await shop(db, 2);
      // Two quick taps land on one sale; the third finds nothing free.
      const [a, b] = await Promise.all([
        addToTableSale(db, s.storeId, s.listingId),
        addToTableSale(db, s.storeId, s.listingId),
      ]);
      expect(a).toBe(b);
      expect(await addToTableSale(db, s.storeId, s.listingId)).toBeNull();
      expect(await tableSale(db, s.storeId)).toEqual({
        id: a,
        items: 2,
        total: 20,
      });
      expect((await heldByListing(db, s.storeId)).get(s.listingId)?.qty).toBe(
        2,
      );
      // It is the vendor's own: no buyer is waiting on it.
      expect(await waitingCount(db, s.storeId)).toBe(0);

      const r = await confirmSale(db, s.storeId, input(s, a!, {}, 2));
      if (!("ok" in r)) throw new Error("expected a sale");
      const [sold] = await salesOf(db, s.storeId);
      expect(sold.buyerEmail).toBeNull();
      expect(sold.buyerName).toBe("Walk-up");
      expect(await qtyOf(db, s.listingId)).toBe(0);
      expect(
        await db.select().from(customer).where(eq(customer.storeId, s.storeId)),
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(receiptEmail)
          .where(eq(receiptEmail.saleId, r.saleId)),
      ).toHaveLength(0);
      expect(await tableSale(db, s.storeId)).toBeNull();
    });

    test("a double tap makes one sale", async () => {
      const s = await shop(db);
      const id = await ask(db, s);
      const [a, b] = await Promise.all([
        confirmSale(db, s.storeId, input(s, id)),
        confirmSale(db, s.storeId, input(s, id)),
      ]);
      if (!("ok" in a) || !("ok" in b)) throw new Error("expected sales");
      expect(a.saleId).toBe(b.saleId);
      expect(await qtyOf(db, s.listingId)).toBe(2);
      expect(await salesOf(db, s.storeId)).toHaveLength(1);
    });

    test("a double tap on Void voids once and restocks once", async () => {
      const s = await shop(db, 3);
      const r = await confirmSale(
        db,
        s.storeId,
        input(s, await ask(db, s, {}, 2), {}, 2),
      );
      if (!("ok" in r)) throw new Error("expected a sale");
      const results = await Promise.all([
        voidSale(db, s.storeId, r.saleId, { restock: true }),
        voidSale(db, s.storeId, r.saleId, { restock: true }),
      ]);
      expect(results.filter((x) => "already" in x)).toHaveLength(1);
      expect(await qtyOf(db, s.listingId)).toBe(3);
      expect(
        await db.select().from(saleVoid).where(eq(saleVoid.saleId, r.saleId)),
      ).toHaveLength(1);
    });

    test("concurrent sales number without gaps", async () => {
      const s = await shop(db, 8);
      const ids = await Promise.all([1, 2, 3, 4].map(() => ask(db, s)));
      await Promise.all(
        ids.map((id) => confirmSale(db, s.storeId, input(s, id))),
      );
      const rows = await salesOf(db, s.storeId);
      expect(rows.map((r) => r.receiptNo).sort()).toEqual([
        "R-0001",
        "R-0002",
        "R-0003",
        "R-0004",
      ]);
      expect(await qtyOf(db, s.listingId)).toBe(4);
    });

    test("a send and a confirm on the same stock never deadlock or oversell", async () => {
      const s = await shop(db, 1);
      const a = await ask(db, s);
      await lapse(db, a);
      const [sold, sent] = await Promise.all([
        confirmSale(db, s.storeId, input(s, a)),
        createRequest(db, {
          storeId: s.storeId,
          lines: [{ listingId: s.listingId, qty: 1 }],
          buyerName: "Kai",
          buyerEmail: "kai@example.test",
          promo: false,
          sessionId: randomUUID(),
          ipHash: null,
          holdMs: 15 * 60_000,
        }),
      ]);
      // Exactly one of them gets the copy.
      expect(Number("ok" in sold) + Number(sent.ok)).toBe(1);
      expect(await qtyOf(db, s.listingId)).toBe("ok" in sold ? 0 : 1);
    });
  });
}

suite("PGlite", migratedDb);

// CI sets DATABASE_URL to a real Postgres, where the confirms truly overlap.
const url = process.env.DATABASE_URL;
describe.runIf(Boolean(url))("Postgres", () => {
  suite("concurrent", async () => {
    const db = drizzle(postgres(url!, { max: 6, onnotice: () => {} }), {
      schema,
    });
    await migrate(db, { migrationsFolder: "drizzle" });
    return db as unknown as Db;
  });
});

test("confirm drops stock, releases the hold, snapshots lines, prices on the server", async () => {
  const db = await migratedDb();
  const s = await shop(db, 3, "10.00");
  const id = await ask(db, s, {}, 2);
  const r = await confirmSale(
    db,
    s.storeId,
    input(s, id, {
      lines: [{ listingId: s.listingId, qty: 2, unitPrice: "9" }],
      discount: { kind: "percent", value: "10" },
    }),
  );
  expect(r).toMatchObject({ ok: true, receiptNo: "R-0001", total: "16.20" });
  expect(await qtyOf(db, s.listingId)).toBe(1);
  expect((await heldByListing(db, s.storeId)).size).toBe(0);
  const [row] = await salesOf(db, s.storeId);
  expect(row).toMatchObject({
    subtotal: "18.00",
    discount: "1.80",
    discountPct: "10.00",
    paymentMethod: "cash",
  });
  const [line] = await db
    .select()
    .from(saleLine)
    .where(eq(saleLine.saleId, row.id));
  expect(line).toMatchObject({
    name: "Mew ex",
    qty: 2,
    unitPrice: "9.00",
    quotedPrice: "10.00",
    gradeLabel: "NM",
  });
  // The numbers belong to the store, not the app.
  const other = await shop(db);
  expect(
    await confirmSale(db, other.storeId, input(other, await ask(db, other))),
  ).toMatchObject({ receiptNo: "R-0001" });
});

test("sales and their lines can't be updated", async () => {
  const db = await migratedDb();
  const s = await shop(db);
  await confirmSale(db, s.storeId, input(s, await ask(db, s)));
  const raises = (q: PromiseLike<unknown>) =>
    Promise.resolve(q).then(
      () => "",
      (e: { message?: string; cause?: { message?: string } }) =>
        `${e.message} ${e.cause?.message ?? ""}`,
    );
  expect(await raises(db.update(sale).set({ total: "0" }))).toContain(
    "sale_immutable",
  );
  expect(await raises(db.update(saleLine).set({ qty: 9 }))).toContain(
    "sale_immutable",
  );
});

test("nothing changes when stock can't cover a line or a line wasn't requested", async () => {
  const db = await migratedDb();
  const s = await shop(db, 2);
  const id = await ask(db, s, {}, 2);
  // The vendor counted one fewer at the table.
  await db.update(listing).set({ qty: 1 }).where(eq(listing.id, s.listingId));
  expect(await confirmSale(db, s.storeId, input(s, id, {}, 2))).toEqual({
    stock: [s.listingId],
  });
  expect(await qtyOf(db, s.listingId)).toBe(1);
  // Up is not allowed, nor a listing nobody asked for, nor a bad discount.
  expect(await confirmSale(db, s.storeId, input(s, id, {}, 3))).toEqual({
    invalid: true,
  });
  const stranger = await shop(db);
  expect(
    await confirmSale(
      db,
      s.storeId,
      input(s, id, {
        lines: [{ listingId: stranger.listingId, qty: 1, unitPrice: "1" }],
      }),
    ),
  ).toEqual({ invalid: true });
  expect(
    await confirmSale(
      db,
      s.storeId,
      input(s, id, { discount: { kind: "amount", value: "99" } }, 1),
    ),
  ).toEqual({ invalid: true });
  expect(await salesOf(db, s.storeId)).toEqual([]);
});

test("an expired hold is confirmable, but not past another buyer's hold", async () => {
  const db = await migratedDb();
  const s = await shop(db, 1);
  const lapsed = await ask(db, s);
  await lapse(db, lapsed);
  const holding = await ask(db, s);
  expect(await confirmSale(db, s.storeId, input(s, lapsed))).toEqual({
    stock: [s.listingId],
  });
  await db
    .update(request)
    .set({ status: "cancelled" })
    .where(eq(request.id, holding));
  expect(await confirmSale(db, s.storeId, input(s, lapsed))).toMatchObject({
    ok: true,
  });
});

test("declined, other stores' and test requests are refused", async () => {
  const db = await migratedDb();
  const s = await shop(db, 5);
  const rehearsal = await ask(db, s, { isTest: true });
  expect(await confirmSale(db, s.storeId, input(s, rehearsal))).toEqual({
    gone: true,
  });
  const id = await ask(db, s);
  const rival = await shop(db);
  expect(await confirmSale(db, rival.storeId, input(s, id))).toEqual({
    gone: true,
  });
  await db
    .update(request)
    .set({ status: "declined" })
    .where(eq(request.id, id));
  expect(await confirmSale(db, s.storeId, input(s, id))).toEqual({
    gone: true,
  });
  expect(await qtyOf(db, s.listingId)).toBe(5);
  expect(
    await db.select().from(customer).where(eq(customer.storeId, s.storeId)),
  ).toEqual([]);
});

test("customer consent: tick opts in, untick keeps it, unsubscribe then tick re-opts", async () => {
  const db = await migratedDb();
  const s = await shop(db, 9);
  const row = async () =>
    (
      await db.select().from(customer).where(eq(customer.storeId, s.storeId))
    )[0];
  const buy = async (promo: boolean, name = "Maya") => {
    const id = await ask(db, s, { promo, buyerName: name });
    await confirmSale(db, s.storeId, input(s, id));
    return row();
  };
  const first = await buy(false);
  expect(first).toMatchObject({
    promoOptIn: false,
    purchases: 1,
    optedInAt: null,
  });
  const ticked = await buy(true, "Maya R");
  expect(ticked).toMatchObject({
    promoOptIn: true,
    purchases: 2,
    name: "Maya R",
  });
  expect(ticked.optedInAt).not.toBeNull();
  expect(ticked.unsubscribeToken).toBe(first.unsubscribeToken);
  expect(ticked.unsubscribeToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(await buy(false)).toMatchObject({ promoOptIn: true, purchases: 3 });

  await optOut(db, ticked.unsubscribeToken);
  const off = await row();
  expect(off.promoOptIn).toBe(false);
  expect(off.optedOutAt).not.toBeNull();
  await optOut(db, "not-a-token");
  expect(await buy(true)).toMatchObject({ promoOptIn: true, optedOutAt: null });
});

test("this request's own live hold doesn't block it, even on the last copy", async () => {
  const db = await migratedDb();
  const s = await shop(db, 1);
  const id = await ask(db, s);
  expect(await confirmSale(db, s.storeId, input(s, id))).toMatchObject({
    ok: true,
  });
  expect(await qtyOf(db, s.listingId)).toBe(0);
});

test("a receipt keeps the store's name and zone, and no outside image host", async () => {
  const db = await migratedDb();
  const s = await shop(db);
  await db
    .update(listing)
    .set({ imageUrl: "https://tracker.example.test/pixel.png" })
    .where(eq(listing.id, s.listingId));
  const id = await ask(db, s);
  await confirmSale(db, s.storeId, input(s, id, { timeZone: "Asia/Tokyo" }));
  await db
    .update(store)
    .set({ name: "Renamed" })
    .where(eq(store.id, s.storeId));
  const [row] = await salesOf(db, s.storeId);
  expect(row.storeName).not.toBe("Renamed");
  expect(row.timeZone).toBe("Asia/Tokyo");
  const [line] = await db
    .select()
    .from(saleLine)
    .where(eq(saleLine.saleId, row.id));
  expect(line.imageUrl).toBeNull();
});

test("deleting an account takes its store and sales with it", async () => {
  const db = await migratedDb();
  const s = await shop(db);
  await confirmSale(db, s.storeId, input(s, await ask(db, s)));
  // A second, open request: its line still points at the listing.
  await ask(db, s);
  const [{ owner }] = await db
    .select({ owner: store.ownerUserId })
    .from(store)
    .where(eq(store.id, s.storeId));
  await db.delete(user).where(eq(user.id, owner));
  expect(await db.select().from(store).where(eq(store.id, s.storeId))).toEqual(
    [],
  );
  expect(await salesOf(db, s.storeId)).toEqual([]);
  expect(await db.select().from(saleLine)).toEqual([]);
  expect(await db.select().from(receiptEmail)).toEqual([]);
});

test("a zone Postgres doesn't know falls back to UTC, so the queue still loads", async () => {
  const db = await migratedDb();
  expect(await postgresZone(db, "Asia/Tokyo")).toBe("Asia/Tokyo");
  const zone = await postgresZone(db, "Mars/Olympus");
  expect(zone).toBe("UTC");
  await db.execute(sql`select ${dayStart(zone)}`);
});

test("today starts at midnight in the seller's zone", async () => {
  const db = await migratedDb();
  const s = await shop(db);
  const tz = "Asia/Tokyo";
  const { rows } = (await db.execute(
    sql`select ${dayStart(tz)} as start`,
  )) as unknown as { rows: { start: string }[] };
  const start = new Date(rows[0].start);
  expect(start.toLocaleTimeString("en-GB", { timeZone: tz })).toBe("00:00:00");
  expect(Date.now() - start.getTime()).toBeLessThan(86_400_000);

  const id = await ask(db, s);
  const lapseAt = (at: string) =>
    db
      .update(request)
      .set({
        expiresAt: sql`now() - interval '1 second'`,
        createdAt: sql`date_trunc('day', now(), ${tz}) + ${at}::interval`,
      })
      .where(eq(request.id, id));
  const expired = async () =>
    (await storeQueue(db, s.storeId, tz)).expired.length;
  await lapseAt("-1 minute");
  expect(await expired()).toBe(0);
  await lapseAt("0 seconds");
  expect(await expired()).toBe(1);
});

async function soldOne(db: Db, qty = 3, n = 2) {
  const s = await shop(db, qty);
  const r = await confirmSale(
    db,
    s.storeId,
    input(s, await ask(db, s, {}, n), {}, n),
  );
  if (!("ok" in r)) throw new Error("expected a sale");
  return { ...s, saleId: r.saleId };
}

test("a void with restock puts the units back, labelled in the ledger", async () => {
  const db = await migratedDb();
  const s = await soldOne(db);
  expect(await qtyOf(db, s.listingId)).toBe(1);
  expect(
    await voidSale(db, s.storeId, s.saleId, {
      restock: true,
      reason: "  Wrong card  ",
    }),
  ).toEqual({ ok: true });
  expect(await qtyOf(db, s.listingId)).toBe(3);
  const [move] = await db
    .select()
    .from(stockMove)
    .where(
      and(eq(stockMove.listingId, s.listingId), eq(stockMove.reason, "voided")),
    );
  expect(move).toMatchObject({ delta: 2, qtyAfter: 3, ref: s.saleId });
  const read = await saleWithLines(db, s.storeId, s.saleId);
  expect(read?.void).toMatchObject({ restocked: true, reason: "Wrong card" });
  // Still listed today, marked, so callers can leave it out of the total.
  const [today] = await salesToday(db, s.storeId, "UTC");
  expect(today).toMatchObject({ id: s.saleId, voided: true });
  // The sale itself is untouched.
  expect((await salesOf(db, s.storeId))[0].total).toBe("20.00");
});

test("a void without restock leaves stock alone", async () => {
  const db = await migratedDb();
  const s = await soldOne(db);
  await voidSale(db, s.storeId, s.saleId, { restock: false });
  expect(await qtyOf(db, s.listingId)).toBe(1);
  expect(
    await db
      .select()
      .from(stockMove)
      .where(
        and(
          eq(stockMove.listingId, s.listingId),
          eq(stockMove.reason, "voided"),
        ),
      ),
  ).toHaveLength(0);
  // A second void changes nothing, even if it asks for the restock.
  expect(await voidSale(db, s.storeId, s.saleId, { restock: true })).toEqual({
    ok: true,
    already: true,
  });
  expect(await qtyOf(db, s.listingId)).toBe(1);
});

test("a void skips a listing deleted since the sale", async () => {
  const db = await migratedDb();
  const s = await soldOne(db);
  await db.delete(listing).where(eq(listing.id, s.listingId));
  expect(await voidSale(db, s.storeId, s.saleId, { restock: true })).toEqual({
    ok: true,
  });
});

test("another store can't void a sale", async () => {
  const db = await migratedDb();
  const s = await soldOne(db);
  const other = await shop(db);
  expect(
    await voidSale(db, other.storeId, s.saleId, { restock: true }),
  ).toEqual({ gone: true });
  expect(await qtyOf(db, s.listingId)).toBe(1);
  expect(await db.select().from(saleVoid)).toHaveLength(0);
});

test("a void reason is capped in the database", async () => {
  const db = await migratedDb();
  const s = await soldOne(db);
  await expect(
    voidSale(db, s.storeId, s.saleId, {
      restock: false,
      reason: "x".repeat(81),
    }),
  ).rejects.toThrow();
});
