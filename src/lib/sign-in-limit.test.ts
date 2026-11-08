import { beforeAll, expect, it } from "vitest";
import type { Db } from "@/db/open";
import { allowMagicLink, clientIp, LIMITS } from "@/lib/sign-in-limit";
import { migratedDb } from "@/lib/test-fixtures";

let db: Db;

beforeAll(async () => {
  db = await migratedDb();
});

it("allows 3 links per email, case-insensitive, then refuses", async () => {
  for (let i = 0; i < LIMITS.email.max; i++)
    expect(await allowMagicLink(db, "A@x.test", `10.0.0.${i}`)).toBe(true);
  expect(await allowMagicLink(db, "a@x.test", "10.0.9.9")).toBe(false);
  expect(await allowMagicLink(db, "b@x.test", "10.0.9.9")).toBe(true);
});

it("allows 10 links per IP across emails, then refuses", async () => {
  for (let i = 0; i < LIMITS.ip.max; i++)
    expect(await allowMagicLink(db, `ip${i}@x.test`, "10.1.1.1")).toBe(true);
  expect(await allowMagicLink(db, "fresh@x.test", "10.1.1.1")).toBe(false);
  // A refused IP attempt does not spend the email's allowance.
  expect(await allowMagicLink(db, "fresh@x.test", "10.1.1.2")).toBe(true);
  expect(await allowMagicLink(db, "other@x.test", null)).toBe(true);
});

it("ignores the spoofable first forwarded hop", () => {
  const h = new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" });
  expect(clientIp(h)).toBe("1.2.3.4");
  h.set("x-real-ip", "5.6.7.8");
  expect(clientIp(h)).toBe("5.6.7.8");
  expect(clientIp(new Headers())).toBeNull();
});
