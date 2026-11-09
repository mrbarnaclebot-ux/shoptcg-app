import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, test, vi } from "vitest";
import type { Db } from "@/db/open";
import { customer } from "@/db/schema";
import { addStore, migratedDb } from "@/lib/test-fixtures";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => holder.db }));
const { GET, POST } = await import("./route");

const oneClick = () => new URLSearchParams({ "List-Unsubscribe": "One-Click" });

const url = (t: string) => `https://x.test/api/unsubscribe?t=${t}`;

const post = (t: string, body: BodyInit = oneClick()) =>
  POST(new Request(url(t), { method: "POST", body }));

test("one-click unsubscribes, and an unknown token looks the same", async () => {
  const db: Db = await migratedDb();
  holder.db = db;
  const storeId = await addStore(db, randomUUID().slice(0, 8));
  const token = randomBytes(32).toString("base64url");
  await db.insert(customer).values({
    storeId,
    email: "maya@example.test",
    name: "Maya",
    promoOptIn: true,
    unsubscribeToken: token,
  });
  const row = async () =>
    (await db.select().from(customer).where(eq(customer.storeId, storeId)))[0];

  expect((await post(token, "something else")).status).toBe(400);
  expect((await row()).promoOptIn).toBe(true);

  expect((await post(randomBytes(32).toString("base64url"))).status).toBe(200);
  expect((await row()).promoOptIn).toBe(true);

  // Opening the link only shows the button.
  vi.stubEnv("BETTER_AUTH_URL", "https://app.test");
  const opened = GET(new Request(url(token)));
  expect(opened.status).toBe(303);
  expect(opened.headers.get("location")).toBe(`https://app.test/u/${token}`);
  expect((await row()).promoOptIn).toBe(true);
  vi.unstubAllEnvs();

  expect((await post(token)).status).toBe(200);
  const off = await row();
  expect(off.promoOptIn).toBe(false);
  expect(off.optedOutAt).not.toBeNull();

  // A compliant client may send it as multipart.
  await db
    .update(customer)
    .set({ promoOptIn: true })
    .where(eq(customer.storeId, storeId));
  const form = new FormData();
  form.set("List-Unsubscribe", "One-Click");
  expect((await post(token, form)).status).toBe(200);
  expect((await row()).promoOptIn).toBe(false);
});
