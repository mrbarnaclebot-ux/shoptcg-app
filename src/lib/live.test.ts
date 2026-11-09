import { expect, test } from "vitest";
import { createHub, notifyLive, subscribe, type LiveEvent } from "@/lib/live";
import { migratedDb } from "@/lib/test-fixtures";

const tick = () => new Promise((r) => setTimeout(r, 50));

test("a committed notify reaches subscribers, a rolled-back one never does", async () => {
  const db = await migratedDb();
  const hub = createHub(db);
  const got: LiveEvent[] = [];
  const off = await subscribe(hub, "s:store-1", (e) => got.push(e));

  await db.transaction(async (tx) => {
    await notifyLive(tx, { s: "store-1", r: "req-1", t: "new" });
  });
  await db
    .transaction(async (tx) => {
      await notifyLive(tx, { s: "store-1", r: "req-2", t: "new" });
      throw new Error("rollback");
    })
    .catch(() => {});
  await notifyLive(db, { s: "store-2", r: "req-3", t: "new" });
  await tick();
  expect(got).toEqual([{ s: "store-1", r: "req-1", t: "new" }]);

  off();
  await notifyLive(db, { s: "store-1", r: "req-4", t: "expired" });
  await tick();
  expect(got).toHaveLength(1);
});
