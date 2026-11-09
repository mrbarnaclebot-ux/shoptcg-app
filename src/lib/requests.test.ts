import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { beforeAll, describe, expect, test } from "vitest";
import type { Db } from "@/db/open";
import * as schema from "@/db/schema";
import { listing, request, requestLine, store } from "@/db/schema";
import { buyerRequest, heldByListing } from "@/lib/request-reads";
import {
  cancelRequest,
  createRequest,
  declineRequest,
  shortName,
  type NewRequest,
} from "@/lib/requests";
import { getPublicStore, listPublicStock } from "@/lib/storefront";
import { addStore, migratedDb } from "@/lib/test-fixtures";

/** An open store with one custom listing at a fixed price. */
async function shop(db: Db, qty = 1, price = "10.00") {
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
      qty,
      overridePrice: price,
    })
    .returning({ id: listing.id });
  return { storeId, listingId: l.id };
}

const ask = (
  s: { storeId: string; listingId: string },
  over: Partial<NewRequest> = {},
): NewRequest => ({
  storeId: s.storeId,
  lines: [{ listingId: s.listingId, qty: 1 }],
  buyerName: "Maya Robinson",
  buyerEmail: "maya@example.test",
  promo: false,
  sessionId: randomUUID(),
  ipHash: null,
  holdMs: 15 * 60_000,
  ...over,
});

const errorText = (err: unknown) => {
  const e = err as { message?: string; cause?: { message?: string } };
  return `${e.message} ${e.cause?.message ?? ""}`;
};

function suite(name: string, open: () => Promise<Db>) {
  describe(name, () => {
    let db: Db;
    beforeAll(async () => {
      db = await open();
    });

    test("two buyers race for the last copy: exactly one hold succeeds", async () => {
      const s = await shop(db);
      const results = await Promise.all([
        createRequest(db, ask(s)),
        createRequest(db, ask(s)),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toEqual({
        ok: false,
        taken: [s.listingId],
      });
      const held = await heldByListing(db, s.storeId);
      expect(held.get(s.listingId)?.qty).toBe(1);
    });

    test("a burst from one phone can't get past the limits", async () => {
      const s = await shop(db, 20);
      const sessionId = randomUUID();
      const results = await Promise.all(
        [1, 2, 3, 4, 5].map((qty) =>
          createRequest(
            db,
            ask(s, { sessionId, lines: [{ listingId: s.listingId, qty }] }),
          ),
        ),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(2);
      expect(results.filter((r) => !r.ok)).toEqual(
        Array(3).fill({ ok: false, limited: true }),
      );
    });

    test("resending the same list returns the same request, even on the last copy", async () => {
      const s = await shop(db);
      const sessionId = randomUUID();
      const first = await createRequest(db, ask(s, { sessionId }));
      const again = await createRequest(db, ask(s, { sessionId }));
      expect(first.ok && again.ok && again.retry).toBe(true);
      expect(first.ok && again.ok && again.id === first.id).toBe(true);
      const held = await heldByListing(db, s.storeId);
      expect(held.get(s.listingId)?.qty).toBe(1);
    });

    test("the trigger refuses a line that would overdraw stock", async () => {
      const s = await shop(db, 1);
      const r = await createRequest(db, ask(s));
      if (!r.ok) throw new Error("first hold failed");
      const [other] = await db
        .insert(request)
        .values({
          storeId: s.storeId,
          code: "ZZZZ",
          termsVersion: "t",
          sessionId: "x",
          expiresAt: sql`now() + interval '15 minutes'`,
        })
        .returning({ id: request.id });
      const insert = db.insert(requestLine).values({
        requestId: other.id,
        listingId: s.listingId,
        qty: 1,
        quotedPrice: "1",
      });
      await expect(insert.then(() => "")).rejects.toSatisfy((e) =>
        errorText(e).includes("hold_exceeds_stock"),
      );
    });
  });
}

suite("PGlite", migratedDb);

// CI sets DATABASE_URL to a real Postgres, where the two sends truly overlap.
const url = process.env.DATABASE_URL;
describe.runIf(Boolean(url))("Postgres", () => {
  suite("concurrent", async () => {
    const db = drizzle(postgres(url!, { max: 4, onnotice: () => {} }), {
      schema,
    });
    await migrate(db, { migrationsFolder: "drizzle" });
    return db as unknown as Db;
  });
});

test("prices are recomputed server side and taken lines are reported", async () => {
  const db = await migratedDb();
  const s = await shop(db, 2, "42.00");
  const r = await createRequest(
    db,
    ask(s, { lines: [{ listingId: s.listingId, qty: 2 }] }),
  );
  expect(r).toMatchObject({ ok: true, items: 2, total: 84 });
  const missing = randomUUID();
  const again = await createRequest(
    db,
    ask(s, {
      lines: [
        { listingId: s.listingId, qty: 1 },
        { listingId: missing, qty: 1 },
      ],
    }),
  );
  expect(again).toEqual({ ok: false, taken: [s.listingId, missing] });
});

test("a closed store takes no requests, but a test request still works", async () => {
  const db = await migratedDb();
  const s = await shop(db);
  await db.update(store).set({ isOpen: false }).where(eq(store.id, s.storeId));
  expect(await createRequest(db, ask(s))).toEqual({ ok: false, closed: true });
  expect((await createRequest(db, ask(s, { isTest: true }))).ok).toBe(true);
});

test("available is qty minus active holds and never below zero", async () => {
  const db = await migratedDb();
  const s = await shop(db, 3);
  await createRequest(
    db,
    ask(s, { lines: [{ listingId: s.listingId, qty: 2 }] }),
  );
  const pub = (await getPublicStore(
    db,
    (await db.select().from(store).where(eq(store.id, s.storeId)))[0].slug,
  ))!;
  expect((await listPublicStock(db, pub))[0]).toMatchObject({
    qty: 3,
    available: 1,
  });
  // Physical stock wins: the vendor may count fewer than are held.
  await db.update(listing).set({ qty: 1 }).where(eq(listing.id, s.listingId));
  const [it] = await listPublicStock(db, pub);
  expect(it).toMatchObject({ qty: 1, available: 0 });
  expect(it.holdMin).toBe(15);
});

test("decline and cancel release the hold and are scoped to their owner", async () => {
  const db = await migratedDb();
  const s = await shop(db, 1);
  const a = ask(s);
  const r = await createRequest(db, a);
  if (!r.ok) throw new Error("hold failed");
  const other = await shop(db);
  expect(await declineRequest(db, other.storeId, r.id)).toBe(false);
  expect(await cancelRequest(db, "someone-else", r.id)).toBe(false);
  expect(await buyerRequest(db, r.id, "someone-else")).toBeNull();
  expect(await declineRequest(db, s.storeId, r.id)).toBe(true);
  expect((await heldByListing(db, s.storeId)).size).toBe(0);
  expect((await buyerRequest(db, r.id, a.sessionId))?.status).toBe("declined");
  expect(await cancelRequest(db, a.sessionId, r.id)).toBe(false);
});

test("shortName keeps a first name and an initial", () => {
  expect(shortName(" maya  robinson ")).toBe("maya R.");
  expect(shortName("Cher")).toBe("Cher");
});
