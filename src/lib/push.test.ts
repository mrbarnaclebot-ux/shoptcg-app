import { expect, test, vi } from "vitest";
import { pushSubscription } from "@/db/schema";
import { pushToUser, vapid } from "@/lib/push";
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
