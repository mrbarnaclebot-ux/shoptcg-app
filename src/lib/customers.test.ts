import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";
import type { Db } from "@/db/open";
import { listing, store } from "@/db/schema";
import {
  listCustomers,
  maskEmail,
  promoRows,
  promoStatus,
  removeCustomer,
  subscribedCount,
} from "@/lib/customers";
import { createRequest } from "@/lib/requests";
import { confirmSale, optOut } from "@/lib/sales";
import { addStore, migratedDb } from "@/lib/test-fixtures";

let db: Db;
beforeAll(async () => {
  db = await migratedDb();
});

async function shop() {
  const storeId = await addStore(db, randomUUID().slice(0, 8));
  await db.update(store).set({ isOpen: true }).where(eq(store.id, storeId));
  const [l] = await db
    .insert(listing)
    .values({
      storeId,
      kind: "raw",
      language: "en",
      name: "Mew ex",
      condition: "NM",
      qty: 9,
      overridePrice: "10.00",
    })
    .returning({ id: listing.id });
  return { storeId, listingId: l.id };
}

/** A purchase through the real flow, so consent follows the real upsert. */
async function ask(
  s: Awaited<ReturnType<typeof shop>>,
  email: string,
  promo: boolean,
  name = "Maya Robinson",
) {
  const r = await createRequest(db, {
    storeId: s.storeId,
    lines: [{ listingId: s.listingId, qty: 1 }],
    buyerName: name,
    buyerEmail: email,
    promo,
    sessionId: randomUUID(),
    ipHash: null,
    holdMs: 15 * 60_000,
  });
  if (!r.ok) throw new Error("request failed");
  return r.id;
}

async function sell(s: Awaited<ReturnType<typeof shop>>, requestId: string) {
  const done = await confirmSale(db, s.storeId, {
    requestId,
    lines: [{ listingId: s.listingId, qty: 1, unitPrice: "10" }],
    discount: { kind: "none" },
    method: "cash",
  });
  if (!("ok" in done)) throw new Error("sale failed");
}

async function buy(
  s: Awaited<ReturnType<typeof shop>>,
  email: string,
  promo: boolean,
  name = "Maya Robinson",
) {
  await sell(s, await ask(s, email, promo, name));
}

const emails = async (storeId: string) =>
  (await promoRows(db, storeId, "UTC")).slice(1).map((r) => r[1]);

it("the promo list is only those who said yes, with a link that opts them out", async () => {
  const s = await shop();
  await buy(s, "yes@example.test", true);
  await buy(s, "no@example.test", false);
  await buy(s, "gone@example.test", true);
  const rows = await promoRows(db, s.storeId, "UTC");
  expect(rows[0]).toEqual([
    "name",
    "email",
    "subscribed_at",
    "unsubscribe_url",
  ]);
  expect(await emails(s.storeId)).toEqual([
    "gone@example.test",
    "yes@example.test",
  ]);
  await optOut(db, new URL(String(rows[1][3])).pathname.slice(3));
  expect(await emails(s.storeId)).toEqual(["yes@example.test"]);
  expect(await subscribedCount(db, s.storeId)).toBe(1);
});

it("an unticked purchase after opting out keeps them out", async () => {
  const s = await shop();
  await buy(s, "maya@example.test", true);
  const [c] = await listCustomers(db, s.storeId);
  await optOut(db, c.unsubscribeToken);
  await buy(s, "maya@example.test", false);
  expect(await emails(s.storeId)).toEqual([]);
});

it("a sale confirmed after an opt-out can't undo it, but a later tick can", async () => {
  const s = await shop();
  await buy(s, "maya@example.test", true);
  const [c] = await listCustomers(db, s.storeId);
  const ticked = await ask(s, "maya@example.test", true);
  await optOut(db, c.unsubscribeToken);
  await sell(s, ticked);
  expect(await emails(s.storeId)).toEqual([]);
  const [after] = await listCustomers(db, s.storeId);
  expect(after.optedOutAt).not.toBeNull();
  expect(after.purchases).toBe(2);

  await buy(s, "maya@example.test", true);
  expect(await emails(s.storeId)).toEqual(["maya@example.test"]);
});

it("after erasure, a purchase with no tick doesn't re-subscribe them", async () => {
  const s = await shop();
  await buy(s, "maya@example.test", true);
  const [c] = await listCustomers(db, s.storeId);
  expect(await removeCustomer(db, s.storeId, c.id)).toBe(true);
  expect(await listCustomers(db, s.storeId)).toEqual([]);

  await buy(s, "maya@example.test", false);
  const [back] = await listCustomers(db, s.storeId);
  expect(back).toMatchObject({ promoOptIn: false, purchases: 1 });
  expect(back.unsubscribeToken).not.toBe(c.unsubscribeToken);
  expect(await emails(s.storeId)).toEqual([]);
});

it("another store's customer can't be removed", async () => {
  const mine = await shop();
  const theirs = await shop();
  await buy(theirs, "maya@example.test", true);
  const [c] = await listCustomers(db, theirs.storeId);
  expect(await removeCustomer(db, mine.storeId, c.id)).toBe(false);
  expect(await listCustomers(db, theirs.storeId)).toHaveLength(1);
});

it("filters by subscribed and searches name or email, wildcards literal", async () => {
  const s = await shop();
  await buy(s, "maya@example.test", true, "Maya Robinson");
  await buy(s, "theo_k@example.test", false, "Theo King");
  const names = async (o: Parameters<typeof listCustomers>[2]) =>
    (await listCustomers(db, s.storeId, o)).map((c) => c.name);
  expect(await names({ subscribed: true })).toEqual(["Maya Robinson"]);
  expect(await names({ q: "theo" })).toEqual(["Theo King"]);
  expect(await names({ q: "ROBIN" })).toEqual(["Maya Robinson"]);
  expect(await names({ q: "THEO_K@" })).toEqual(["Theo King"]);
  expect(await names({ q: "%" })).toEqual([]);
  expect(await names({ q: "ma_a" })).toEqual([]);
});

it("the status says where consent stands", () => {
  const at = new Date("2026-11-09T12:00:00Z");
  const row = { promoOptIn: false, optedInAt: null, optedOutAt: null };
  expect(promoStatus(row, "UTC")).toEqual({
    state: "receipts",
    text: "Receipts only. No promos.",
  });
  expect(
    promoStatus({ ...row, promoOptIn: true, optedInAt: at }, "UTC"),
  ).toEqual({ state: "subscribed", text: "Subscribed since Nov 9" });
  expect(promoStatus({ ...row, optedOutAt: at }, "UTC")).toEqual({
    state: "unsubscribed",
    text: "Unsubscribed Nov 9. Don't email.",
  });
});

it("an email is masked to its first letter and domain", () => {
  expect(maskEmail("maya@example.test")).toBe("m•••@example.test");
});
