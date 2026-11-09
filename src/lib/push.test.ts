import { expect, test, vi } from "vitest";
import { pushSubscription } from "@/db/schema";
import { MAX_PUSH_DEVICES, pushToUser, savePush, vapid } from "@/lib/push";
import { addStore, migratedDb } from "@/lib/test-fixtures";

test("push skips without VAPID keys and deletes subscriptions the browser dropped", async () => {
  expect(vapid({})).toBeNull();
  const db = await migratedDb();
  await addStore(db, "u1");
  const sub = (endpoint: string) => ({
    endpoint,
    userId: "u1",
    p256dh: "k",
    auth: "a",
  });
  await db
    .insert(pushSubscription)
    .values([sub("https://push.test/ok"), sub("https://push.test/gone")]);
  const send = vi.fn(async (s: { endpoint: string }) => {
    if (s.endpoint.endsWith("gone")) throw { statusCode: 410 };
  });
  const msg = { title: "t", body: "b", tag: "x", url: "/dashboard" };
  await pushToUser(db, "u1", msg, send);
  expect(send).toHaveBeenCalledTimes(2);
  const left = await db.select().from(pushSubscription);
  expect(left.map((s) => s.endpoint)).toEqual(["https://push.test/ok"]);
  await pushToUser(db, "u1", msg, null);
  expect(send).toHaveBeenCalledTimes(2);
});

test("a vendor keeps their newest devices, and a re-save counts as recent", async () => {
  const db = await migratedDb();
  await addStore(db, "cap");
  await addStore(db, "other");
  const row = (n: string, userId = "cap") => ({
    endpoint: `https://push.test/${n}`,
    userId,
    p256dh: "k",
    auth: "a",
  });
  await db.insert(pushSubscription).values(row("theirs", "other"));
  await db.insert(pushSubscription).values(
    Array.from({ length: MAX_PUSH_DEVICES }, (_, i) => ({
      ...row(`old${i}`),
      createdAt: new Date(Date.UTC(2026, 0, 1 + i)),
    })),
  );
  await savePush(db, row("old0"));
  await savePush(db, row("new"));
  const left = (await db.select().from(pushSubscription)).map((s) =>
    s.endpoint.replace("https://push.test/", ""),
  );
  expect(left).toHaveLength(MAX_PUSH_DEVICES + 1);
  expect(left).toEqual(expect.arrayContaining(["old0", "new", "theirs"]));
  expect(left).not.toContain("old1");
});
