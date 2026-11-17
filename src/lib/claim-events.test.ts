import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { beforeAll, describe, expect, test } from "vitest";
import type { Db } from "@/db/open";
import * as schema from "@/db/schema";
import { claimEvent, listing, request, store } from "@/db/schema";
import {
  blockBuyer,
  claim,
  createEvent,
  endEvent,
  eventStock,
  joinEvent,
  LIMITS,
  normalizePhone,
  publicEvent,
  unclaim,
  type NewEvent,
} from "@/lib/claim-events";
import { addToTableSale, createRequest, declineRequest } from "@/lib/requests";
import { getPublicStore, listPublicStock } from "@/lib/storefront";
import { addStore, migratedDb } from "@/lib/test-fixtures";

const MIN = 60_000;

async function shop(db: Db, qtys: number[] = [1], mode = "online" as const) {
  const storeId = await addStore(db, randomUUID().slice(0, 8));
  await db
    .update(store)
    .set({ state: "open", openedAt: new Date(), sellingMode: mode })
    .where(eq(store.id, storeId));
  const ids = [];
  for (const qty of qtys) {
    const [l] = await db
      .insert(listing)
      .values({
        storeId,
        kind: "sealed",
        language: "en",
        name: "Booster box",
        qty,
        overridePrice: "100.00",
      })
      .returning({ id: listing.id });
    ids.push(l.id);
  }
  const [s] = await db.select().from(store).where(eq(store.id, storeId));
  return { storeId, slug: s.slug, ids };
}

const event = (ids: string[], over: Partial<NewEvent> = {}): NewEvent => ({
  title: "Friday drop",
  startsAt: new Date(Date.now() - MIN),
  endsAt: new Date(Date.now() + 60 * MIN),
  priceMode: "market",
  allowUnclaim: true,
  payWithinHours: 24,
  maxPerBuyer: 5,
  items: ids.map((listingId) => ({ listingId, price: null, maxPerBuyer: 1 })),
  ...over,
});

let n = 0;
const buyer = () => {
  n++;
  return {
    sessionId: randomUUID(),
    ipHash: null as string | null,
    buyer: {
      name: `Buyer ${n}`,
      phone: `9477100${String(n).padStart(4, "0")}`,
      email: `b${n}@example.test`,
    },
  };
};

async function live(db: Db, qtys = [1], over: Partial<NewEvent> = {}) {
  const s = await shop(db, qtys);
  const r = await createEvent(db, s.storeId, event(s.ids, over));
  if (!("ok" in r)) throw new Error(r.error);
  return { ...s, eventId: r.id, e: { id: r.id, storeId: s.storeId } };
}

async function join(db: Db, e: { id: string; storeId: string }) {
  const b = buyer();
  const r = await joinEvent(db, e, b, b.buyer);
  if (!("ok" in r)) throw new Error(JSON.stringify(r));
  return { ...b, requestId: r.id };
}

/** Lifts the once-a-second limit so a test can claim again at once. */
const rested = (db: Db, requestId: string) =>
  db
    .update(request)
    .set({ lastClaimAt: null })
    .where(eq(request.id, requestId));

const status = async (db: Db, slug: string, id: string) =>
  (await publicEvent(db, id, slug))?.status;

function suite(name: string, open: () => Promise<Db>) {
  describe(name, () => {
    let db: Db;
    beforeAll(async () => {
      db = await open();
    });

    test("a crowd on three units: never more than three claims", async () => {
      const s = await live(db, [3]);
      const crowd = [];
      for (let i = 0; i < 20; i++) crowd.push(await join(db, s.e));
      const results = await Promise.all(
        crowd.map((b) => claim(db, s.eventId, b.sessionId, s.ids[0])),
      );
      expect(results.filter((r) => "ok" in r)).toHaveLength(3);
      expect(results.filter((r) => "taken" in r)).toHaveLength(17);
    });

    test("two buyers race for the last unit: exactly one claim wins", async () => {
      const s = await live(db);
      const [a, b] = [await join(db, s.e), await join(db, s.e)];
      const results = await Promise.all([
        claim(db, s.eventId, a.sessionId, s.ids[0]),
        claim(db, s.eventId, b.sessionId, s.ids[0]),
      ]);
      expect(results.filter((r) => "ok" in r)).toHaveLength(1);
      expect(results).toContainEqual({ taken: true });
      expect(await status(db, s.slug, s.eventId)).toBe("sold_out");
    });

    test("status follows the clock and the vendor's end", async () => {
      const s = await live(db, [1], {
        startsAt: new Date(Date.now() + 10 * MIN),
        endsAt: new Date(Date.now() + 20 * MIN),
      });
      expect(await status(db, s.slug, s.eventId)).toBe("scheduled");
      const a = await join(db, s.e);
      expect(await claim(db, s.eventId, a.sessionId, s.ids[0])).toEqual({
        notLive: true,
      });
      await db
        .update(claimEvent)
        .set({ startsAt: new Date(Date.now() - MIN) })
        .where(eq(claimEvent.id, s.eventId));
      expect(await status(db, s.slug, s.eventId)).toBe("live");
      expect(await endEvent(db, s.storeId, s.eventId)).toBe(true);
      expect(await status(db, s.slug, s.eventId)).toBe("ended");
      expect(await endEvent(db, s.storeId, s.eventId)).toBe(false);
      expect(await claim(db, s.eventId, a.sessionId, s.ids[0])).toEqual({
        notLive: true,
      });
      const t = await live(db);
      await db
        .update(claimEvent)
        .set({ endsAt: sql`now() - interval '1 second'` })
        .where(eq(claimEvent.id, t.eventId));
      expect(await status(db, t.slug, t.eventId)).toBe("ended");
    });

    test("a claim needs a joined buyer", async () => {
      const s = await live(db);
      expect(await claim(db, s.eventId, randomUUID(), s.ids[0])).toEqual({
        notJoined: true,
      });
    });

    test("caps per item and per event, and one claim a second", async () => {
      const s = await live(db, [5, 5, 5], {
        maxPerBuyer: 3,
      });
      const a = await join(db, s.e);
      const go = async (id: string) => {
        await rested(db, a.requestId);
        return claim(db, s.eventId, a.sessionId, id);
      };
      expect(await go(s.ids[0])).toEqual({ ok: true });
      expect(await claim(db, s.eventId, a.sessionId, s.ids[1])).toEqual({
        slow: true,
      });
      expect(await go(s.ids[0])).toEqual({ limit: "item" });
      expect(await go(s.ids[1])).toEqual({ ok: true });
      expect(await go(s.ids[2])).toEqual({ ok: true });
      await db
        .update(claimEvent)
        .set({ maxPerBuyer: 2 })
        .where(eq(claimEvent.id, s.eventId));
      expect(await go(s.ids[2])).toEqual({ limit: "item" });
    });

    test("the per-event cap counts every unit", async () => {
      const s = await live(db, [9], { maxPerBuyer: 2 });
      await db.execute(
        sql`update claim_event_item set max_per_buyer = 9 where event_id = ${s.eventId}`,
      );
      const a = await join(db, s.e);
      for (const want of [{ ok: true }, { ok: true }, { limit: "event" }]) {
        await rested(db, a.requestId);
        expect(await claim(db, s.eventId, a.sessionId, s.ids[0])).toEqual(want);
      }
    });

    test("join limits: one phone and email per event, the IP cap, a block", async () => {
      const s = await live(db);
      const a = await join(db, s.e);
      const again = await joinEvent(db, s.e, a, a.buyer);
      expect(again).toEqual({ ok: true, id: a.requestId });
      const c = buyer();
      expect(
        await joinEvent(db, s.e, c, { ...c.buyer, phone: a.buyer.phone }),
      ).toEqual({ taken: "phone" });
      expect(
        await joinEvent(db, s.e, c, { ...c.buyer, email: a.buyer.email }),
      ).toEqual({ taken: "email" });

      const ip = randomUUID();
      for (let i = 0; i < LIMITS.joinsPerIp; i++) {
        const b = buyer();
        expect(
          "ok" in (await joinEvent(db, s.e, { ...b, ipHash: ip }, b.buyer)),
        ).toBe(true);
      }
      const over = buyer();
      expect(
        await joinEvent(db, s.e, { ...over, ipHash: ip }, over.buyer),
      ).toEqual({
        limited: true,
      });

      expect(await blockBuyer(db, s.storeId, a.requestId)).toBe(true);
      const t = await live(db);
      expect(await joinEvent(db, t.e, a, a.buyer)).toEqual({
        ok: true,
        id: expect.any(String),
      });
      // The block is the store's, so this store's next event refuses them too.
      await endEvent(db, t.storeId, t.eventId);
      const fresh = buyer();
      const [{ id }] = await db
        .insert(claimEvent)
        .values({
          storeId: s.storeId,
          title: "Next",
          startsAt: new Date(Date.now() - MIN),
          endsAt: new Date(Date.now() + MIN),
          priceMode: "market",
        })
        .returning({ id: claimEvent.id });
      expect(
        await joinEvent(db, { id, storeId: s.storeId }, fresh, {
          ...fresh.buyer,
          phone: a.buyer.phone,
        }),
      ).toEqual({ blocked: true });
    });

    test("unclaim and decline put the unit back in a live event", async () => {
      const s = await live(db);
      const a = await join(db, s.e);
      const b = await join(db, s.e);
      await claim(db, s.eventId, a.sessionId, s.ids[0]);
      expect(await status(db, s.slug, s.eventId)).toBe("sold_out");
      expect(await unclaim(db, s.eventId, a.sessionId, s.ids[0])).toBe(true);
      expect(await status(db, s.slug, s.eventId)).toBe("live");
      expect(await unclaim(db, s.eventId, a.sessionId, s.ids[0])).toBe(false);
      expect(await claim(db, s.eventId, b.sessionId, s.ids[0])).toEqual({
        ok: true,
      });
      expect(await declineRequest(db, s.storeId, b.requestId)).toBe(true);
      const pub = await publicEvent(db, s.eventId, s.slug);
      const { items } = await eventStock(db, pub!, a.sessionId);
      expect(items[0]).toMatchObject({ available: 1, mine: 0, price: 100 });
    });

    test("unclaim is off unless the event allows it", async () => {
      const s = await live(db, [1], { allowUnclaim: false });
      const a = await join(db, s.e);
      await claim(db, s.eventId, a.sessionId, s.ids[0]);
      expect(await unclaim(db, s.eventId, a.sessionId, s.ids[0])).toBe(false);
    });

    test("event stock stays out of the store, cart and table sale until the end", async () => {
      const s = await live(db, [2]);
      const pub = (await getPublicStore(db, s.slug))!;
      expect(await listPublicStock(db, pub)).toHaveLength(0);
      const cart = await createRequest(db, {
        storeId: s.storeId,
        lines: [{ listingId: s.ids[0], qty: 1 }],
        buyerName: "Cart buyer",
        buyerEmail: "cart@example.test",
        promo: false,
        sessionId: randomUUID(),
        ipHash: null,
        holdMs: 15 * MIN,
      });
      expect(cart).toEqual({ ok: false, taken: [s.ids[0]] });
      expect(await addToTableSale(db, s.storeId, s.ids[0])).toBeNull();

      const a = await join(db, s.e);
      await claim(db, s.eventId, a.sessionId, s.ids[0]);
      await endEvent(db, s.storeId, s.eventId);
      // Unclaimed units go back to the store; the claim stays held to be paid.
      const [it] = await listPublicStock(db, pub);
      expect(it).toMatchObject({ qty: 2, available: 1 });
      await declineRequest(db, s.storeId, a.requestId);
      expect((await listPublicStock(db, pub))[0].available).toBe(2);
    });

    test("custom prices are snapshotted on the claim", async () => {
      const s = await shop(db, [1]);
      const r = await createEvent(
        db,
        s.storeId,
        event(s.ids, {
          priceMode: "custom",
          items: [{ listingId: s.ids[0], price: "42.50", maxPerBuyer: 1 }],
        }),
      );
      if (!("ok" in r)) throw new Error(r.error);
      const a = await join(db, { id: r.id, storeId: s.storeId });
      await claim(db, r.id, a.sessionId, s.ids[0]);
      const pub = await publicEvent(db, r.id, s.slug);
      const { mine } = await eventStock(db, pub!, a.sessionId);
      expect(mine?.total).toBe(42.5);
    });

    test("createEvent refuses table stores, a second open event and unpriced items", async () => {
      const t = await shop(db, [1], "table" as "online");
      await db
        .update(store)
        .set({ sellingMode: "table" })
        .where(eq(store.id, t.storeId));
      expect(await createEvent(db, t.storeId, event(t.ids))).toEqual({
        error: "Claim events are for online stores.",
      });
      const s = await live(db, [1, 1]);
      expect(await createEvent(db, s.storeId, event([s.ids[1]]))).toMatchObject(
        {
          error: expect.stringContaining("End your current event"),
        },
      );
      const u = await shop(db, [1]);
      await db
        .update(listing)
        .set({ overridePrice: null })
        .where(eq(listing.id, u.ids[0]));
      expect(await createEvent(db, u.storeId, event(u.ids))).toMatchObject({
        error: expect.stringContaining("has no price yet"),
      });
      expect(
        await createEvent(
          db,
          u.storeId,
          event(u.ids, {
            priceMode: "custom",
            items: [{ listingId: u.ids[0], price: null, maxPerBuyer: 1 }],
          }),
        ),
      ).toMatchObject({ error: expect.stringContaining("Set a price") });
    });
  });
}

suite("PGlite", migratedDb);

// CI sets DATABASE_URL to a real Postgres, where the claims truly overlap.
const url = process.env.DATABASE_URL;
describe.runIf(Boolean(url))("Postgres", () => {
  suite("concurrent", async () => {
    const db = drizzle(postgres(url!, { max: 8, onnotice: () => {} }), {
      schema,
    });
    await migrate(db, { migrationsFolder: "drizzle" });
    return db as unknown as Db;
  });
});

test("normalizePhone keeps digits with a country code", () => {
  expect(normalizePhone("+94 77 123 4567", null)).toBe("94771234567");
  expect(normalizePhone("0094771234567", null)).toBe("94771234567");
  expect(normalizePhone("077 123 4567", "94779999999")).toBe("94771234567");
  expect(normalizePhone("07700 900123", "447700900999")).toBe("447700900123");
  expect(normalizePhone("077 123 4567", null)).toBeNull();
  expect(normalizePhone("12", null)).toBeNull();
});
