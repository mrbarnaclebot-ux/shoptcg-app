import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { slugSchema } from "@/lib/slug";
import { createStore, getStoreBySlug } from "@/lib/stores";

let db: Db;

async function addUser(id: string) {
  await db.insert(schema.user).values({ id, name: "", email: `${id}@x.test` });
}

beforeAll(async () => {
  // In-memory PGlite runs the real migrations, so DB constraints are exercised too.
  db = drizzle(new PGlite(), { schema });
  await migrate(db as Parameters<typeof migrate>[0], {
    migrationsFolder: "drizzle",
  });
  await addUser("u1");
  await addUser("u2");
});

describe("slugSchema", () => {
  it.each(["ab", "a".repeat(41), "Has-Caps", "under_score", "login", "terms"])(
    "rejects %s",
    (slug) => expect(slugSchema.safeParse(slug).success).toBe(false),
  );
  it.each(["abc", "pika-cards-99", "a".repeat(40)])("accepts %s", (slug) =>
    expect(slugSchema.safeParse(slug).success).toBe(true),
  );
});

describe("createStore", () => {
  it("creates a store with defaults", async () => {
    const res = await createStore(db, "u1", {
      name: " Pika Cards ",
      slug: "pika",
    });
    expect(res.ok).toBe(true);
    const row = await getStoreBySlug(db, "pika");
    expect(row).toMatchObject({
      name: "Pika Cards",
      isOpen: false,
      priceRulePct: 0,
    });
  });

  it("rejects invalid input before touching the DB", async () => {
    const res = await createStore(db, "u2", { name: "", slug: "API" });
    expect(res).toEqual({
      ok: false,
      errors: { name: expect.any(String), slug: expect.any(String) },
    });
  });

  it("rejects a taken slug and a second store per owner", async () => {
    const taken = await createStore(db, "u2", { name: "X", slug: "pika" });
    expect(taken).toEqual({
      ok: false,
      errors: { slug: "That address is taken" },
    });
    const second = await createStore(db, "u1", { name: "Y", slug: "other" });
    expect(second).toEqual({
      ok: false,
      errors: { form: "You already have a store" },
    });
  });

  it("enforces the slug format in the database itself", async () => {
    const bad = db
      .insert(schema.store)
      .values({ ownerUserId: "u2", name: "Z", slug: "NO" });
    await expect(bad).rejects.toThrow();
  });
});
