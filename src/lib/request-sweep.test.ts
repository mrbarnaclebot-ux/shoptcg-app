import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { expect, test } from "vitest";
import type { Db } from "@/db/open";
import { listing, request, requestLine, store } from "@/db/schema";
import { createHub, subscribe, type LiveEvent } from "@/lib/live";
import { ipHash, requestLimited } from "@/lib/request-limit";
import { buyerRequest, heldByListing } from "@/lib/request-reads";
import { sweepRequests } from "@/lib/request-sweep";
import { requestCode } from "@/lib/requests";
import { addStore, migratedDb } from "@/lib/test-fixtures";

async function shop(db: Db) {
  const storeId = await addStore(db, randomUUID().slice(0, 8));
  await db
    .update(store)
    .set({ state: "open", openedAt: new Date() })
    .where(eq(store.id, storeId));
  const [l] = await db
    .insert(listing)
    .values({ storeId, kind: "sealed", language: "en", name: "Box", qty: 1 })
    .returning({ id: listing.id });
  return { storeId, listingId: l.id };
}

/** A request row created `agoMin` minutes ago that held for `holdMin`. */
async function past(
  db: Db,
  storeId: string,
  o: { agoMin: number; holdMin: number; sid?: string; ip?: string },
) {
  const created = sql`now() - make_interval(mins => ${o.agoMin})`;
  const [r] = await db
    .insert(request)
    .values({
      storeId,
      code: requestCode(),
      buyerName: "Maya",
      buyerEmail: "maya@example.test",
      termsVersion: "t",
      sessionId: o.sid ?? randomUUID(),
      ipHash: o.ip ?? null,
      createdAt: created,
      expiresAt: sql`${created} + make_interval(secs => ${o.holdMin * 60})`,
    })
    .returning({ id: request.id });
  return r.id;
}

test("a lapsed hold reads as expired before the sweeper, which then flips and announces it", async () => {
  const db = await migratedDb();
  const s = await shop(db);
  const sid = randomUUID();
  const id = await past(db, s.storeId, { agoMin: 20, holdMin: 15, sid });
  await db.execute(sql`alter table request_line disable trigger user`);
  await db.insert(requestLine).values({
    requestId: id,
    listingId: s.listingId,
    qty: 1,
    quotedPrice: "1",
  });
  await db.execute(sql`alter table request_line enable trigger user`);

  expect((await heldByListing(db, s.storeId)).size).toBe(0);
  expect((await buyerRequest(db, id, sid))?.status).toBe("expired");

  const got: LiveEvent[] = [];
  await subscribe(createHub(db), `r:${id}`, (e) => got.push(e));
  expect(await sweepRequests(db)).toMatchObject({ expired: 1 });
  await new Promise((r) => setTimeout(r, 50));
  expect(got).toEqual([{ s: s.storeId, r: id, t: "expired" }]);
  const [row] = await db.select().from(request).where(eq(request.id, id));
  expect(row.status).toBe("expired");
  expect((await sweepRequests(db)).expired).toBe(0);
});

test("unsold requests lose buyer details after 30 days", async () => {
  const db = await migratedDb();
  const s = await shop(db);
  const old = await past(db, s.storeId, { agoMin: 31 * 1440, holdMin: 15 });
  const recent = await past(db, s.storeId, { agoMin: 29 * 1440, holdMin: 15 });
  expect((await sweepRequests(db)).purged).toBe(1);
  const rows = await db.select().from(request);
  const by = new Map(rows.map((r) => [r.id, r]));
  expect(by.get(old)).toMatchObject({ buyerName: null, buyerEmail: null });
  expect(by.get(recent)?.buyerEmail).toBe("maya@example.test");
});

test("phone and address go after 30 days, sold or not", async () => {
  const db = await migratedDb();
  const s = await shop(db);
  const old = await past(db, s.storeId, { agoMin: 31 * 1440, holdMin: 15 });
  const recent = await past(db, s.storeId, { agoMin: 29 * 1440, holdMin: 15 });
  const contact = { buyerPhone: "077 123 4567", deliveryAddress: "Colombo 3" };
  // Confirmed keeps its name and email for the receipt, but not these.
  await db
    .update(request)
    .set({ ...contact, status: "confirmed" })
    .where(eq(request.id, old));
  await db.update(request).set(contact).where(eq(request.id, recent));
  await sweepRequests(db);
  const rows = await db.select().from(request);
  const by = new Map(rows.map((r) => [r.id, r]));
  expect(by.get(old)).toMatchObject({
    buyerPhone: null,
    deliveryAddress: null,
    buyerEmail: "maya@example.test",
  });
  expect(by.get(recent)).toMatchObject(contact);
});

test("rate limits: 3 per phone per 10 minutes, 2 pending per store, 30 per address", async () => {
  const db = await migratedDb();
  const s = await shop(db);
  const sid = randomUUID();
  const key = { sessionId: sid, storeId: s.storeId, ipHash: null };
  // Already lapsed, so only the 10-minute count applies.
  for (let i = 0; i < 3; i++) {
    expect(await requestLimited(db, key)).toBe(false);
    await past(db, s.storeId, { agoMin: 1, holdMin: 0.5, sid });
  }
  expect(await requestLimited(db, key)).toBe(true);

  const two = { ...key, sessionId: randomUUID() };
  await past(db, s.storeId, { agoMin: 0, holdMin: 15, sid: two.sessionId });
  expect(await requestLimited(db, two)).toBe(false);
  await past(db, s.storeId, { agoMin: 0, holdMin: 15, sid: two.sessionId });
  expect(await requestLimited(db, two)).toBe(true);

  const ip = ipHash("203.0.113.9", "secret");
  expect(ip).not.toContain("203");
  for (let i = 0; i < 30; i++)
    await past(db, s.storeId, { agoMin: 1, holdMin: 0.5, ip });
  const fresh = { sessionId: randomUUID(), storeId: s.storeId };
  expect(await requestLimited(db, { ...fresh, ipHash: ip })).toBe(true);
  expect(
    await requestLimited(db, { ...fresh, ipHash: ipHash("x", "secret") }),
  ).toBe(false);
});
