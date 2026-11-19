import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { slugSchema } from "@/lib/slug";
import {
  changeSlug,
  createStore,
  getStoreByOwner,
  MAX_OLD_SLUGS,
  movedSlug,
  SLUG_TAKEN,
  getStoreBySlug,
  setStoreState,
  whatsappSchema,
} from "@/lib/stores";

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
  it.each([
    "ab",
    "a".repeat(41),
    "Has-Caps",
    "under_score",
    "login",
    "terms",
    "-pika",
    "pika-",
    "pika--cards",
  ])("rejects %s", (slug) =>
    expect(slugSchema.safeParse(slug).success).toBe(false),
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
      state: "paused",
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

  it("maps a postgres-js duplicate slug error (constraint_name)", async () => {
    // postgres-js names the field constraint_name; PGlite uses constraint.
    const err = {
      cause: { code: "23505", constraint_name: "store_slug_unique" },
    };
    const returning = () => Promise.reject(err);
    const fake = {
      select: () => ({ from: () => ({ where: async () => [] }) }),
      insert: () => ({ values: () => ({ returning }) }),
    };
    const res = await createStore(fake as unknown as Db, "u3", {
      name: "X",
      slug: "taken",
    });
    expect(res).toEqual({
      ok: false,
      errors: { slug: "That address is taken" },
    });
  });

  it("enforces the slug format in the database itself", async () => {
    for (const slug of ["NO", "-abc", "abc-", "ab--cd"]) {
      const bad = db
        .insert(schema.store)
        .values({ ownerUserId: "u2", name: "Z", slug });
      await expect(bad).rejects.toThrow();
    }
  });
});

describe("store state", () => {
  const live = async () => (await getStoreByOwner(db, "u1"))!;
  const set = (v: PgUpdateSetSource<typeof schema.store>) =>
    db.update(schema.store).set(v).where(eq(schema.store.ownerUserId, "u1"));

  it("changes only the owner's store", async () => {
    expect(await setStoreState(db, "u1", "open")).toBe(true);
    expect((await live()).live).toBe("open");
    expect(await setStoreState(db, "nobody", "off")).toBe(false);
    expect((await live()).live).toBe("open");
  });

  it("a timed pause counts down, then reopens by itself", async () => {
    await setStoreState(db, "u1", "paused", 15 * 60_000);
    expect(await live()).toMatchObject({ live: "paused", resumesInMin: 15 });
    expect((await live()).changesInMs).toBeGreaterThan(14 * 60_000);
    await set({ pausedUntil: sql`now() - interval '1 second'` });
    expect(await live()).toMatchObject({ live: "open", resumesInMin: null });
  });

  it("an open-ended pause stays paused with no timer", async () => {
    await setStoreState(db, "u1", "paused", null);
    expect(await live()).toMatchObject({
      live: "paused",
      resumesInMin: null,
      changesInMs: null,
      autoPaused: false,
    });
  });

  it("an open store pauses itself 14 hours after opening", async () => {
    await set({
      state: "open",
      openedAt: sql`now() - interval '13 hours 59 minutes'`,
    });
    expect(await live()).toMatchObject({ live: "open", autoPaused: false });
    expect((await live()).changesInMs).toBeLessThan(61_000);
    await set({ openedAt: sql`now() - interval '14 hours 1 minute'` });
    expect(await live()).toMatchObject({ live: "paused", autoPaused: true });
  });

  it("a pause that ran out gets its own 14 hours, then pauses", async () => {
    await set({
      state: "paused",
      pausedUntil: sql`now() - interval '13 hours'`,
    });
    expect((await live()).live).toBe("open");
    await set({ pausedUntil: sql`now() - interval '15 hours'` });
    expect(await live()).toMatchObject({ live: "paused", autoPaused: true });
  });

  it("an online store stays open with no 14-hour window", async () => {
    await set({
      state: "open",
      sellingMode: "online",
      openedAt: sql`now() - interval '3 days'`,
    });
    expect(await live()).toMatchObject({
      live: "open",
      autoPaused: false,
      changesInMs: null,
    });
    // A timed pause that ran out long ago reopens it too.
    await set({
      state: "paused",
      pausedUntil: sql`now() - interval '2 days'`,
    });
    expect(await live()).toMatchObject({ live: "open", autoPaused: false });
    // Pauses still count down, and switching back brings the window back.
    await setStoreState(db, "u1", "paused", 15 * 60_000);
    expect(await live()).toMatchObject({ live: "paused", resumesInMin: 15 });
    await set({
      state: "open",
      sellingMode: "table",
      openedAt: sql`now() - interval '15 hours'`,
    });
    expect(await live()).toMatchObject({ live: "paused", autoPaused: true });
  });

  it("not vending ignores every timer", async () => {
    await set({
      state: "off",
      openedAt: sql`now()`,
      pausedUntil: sql`now() - interval '1 minute'`,
    });
    expect(await live()).toMatchObject({ live: "off", changesInMs: null });
  });

  it("opening starts a fresh window and clears a pause", async () => {
    await set({
      state: "paused",
      openedAt: sql`now() - interval '20 hours'`,
      pausedUntil: sql`now() + interval '1 hour'`,
    });
    await setStoreState(db, "u1", "open");
    const row = await live();
    expect(row).toMatchObject({ live: "open", pausedUntil: null });
  });
});

it("the migration keeps open stores open and closed ones paused", async () => {
  // Every migration up to 0014, then two stores the old way, then the rest.
  const dir = mkdtempSync(join(tmpdir(), "states-"));
  cpSync("drizzle", dir, { recursive: true });
  const journalPath = join(dir, "meta", "_journal.json");
  const full = JSON.parse(readFileSync(journalPath, "utf8"));
  const before = full.entries.findIndex(
    (e: { tag: string }) => e.tag === "0015_store_states",
  );
  writeFileSync(
    journalPath,
    JSON.stringify({ ...full, entries: full.entries.slice(0, before) }),
  );
  const old = drizzle(new PGlite(), { schema });
  await migrate(old as Parameters<typeof migrate>[0], {
    migrationsFolder: dir,
  });
  await old.execute(
    sql`insert into "user" (id, name, email) values ('a', '', 'a@x.test'), ('b', '', 'b@x.test')`,
  );
  await old.execute(
    sql`insert into store (owner_user_id, slug, name, is_open) values ('a', 'was-open', 'A', true), ('b', 'was-closed', 'B', false)`,
  );
  writeFileSync(journalPath, JSON.stringify(full));
  await migrate(old as Parameters<typeof migrate>[0], {
    migrationsFolder: dir,
  });
  const now = old as unknown as Db;
  expect((await getStoreByOwner(now, "a"))?.live).toBe("open");
  expect((await getStoreByOwner(now, "b"))?.live).toBe("paused");
});

describe("whatsappSchema", () => {
  it("keeps the digits wa.me wants, with the country code", () => {
    expect(whatsappSchema.parse("+94 77 123-4567")).toBe("94771234567");
    expect(whatsappSchema.parse("(1) 415 555 0100")).toBe("14155550100");
    expect(whatsappSchema.parse("  ")).toBeNull();
  });
  it("refuses a local number without the country code", () => {
    expect(whatsappSchema.safeParse("077 123 4567").success).toBe(false);
    expect(whatsappSchema.safeParse("12345").success).toBe(false);
  });
});

describe("changeSlug", () => {
  it("moves the store, keeps the old link and guards it", async () => {
    await addUser("s1");
    await addUser("s2");
    await createStore(db, "s1", { name: "Old Name", slug: "pokekade" });
    await createStore(db, "s2", { name: "Other", slug: "other-store" });

    expect(await changeSlug(db, "s1", "uzitcg")).toEqual({
      ok: true,
      slug: "uzitcg",
    });
    expect((await getStoreByOwner(db, "s1"))?.slug).toBe("uzitcg");
    expect(await movedSlug(db, "pokekade")).toBe("uzitcg");
    expect(await movedSlug(db, "nobody")).toBeNull();

    // Nobody else can take the old link, by rename or by a new store.
    expect(await changeSlug(db, "s2", "pokekade")).toEqual({
      ok: false,
      error: SLUG_TAKEN,
    });
    await addUser("s3");
    const made = await createStore(db, "s3", { name: "X", slug: "pokekade" });
    expect(made.ok).toBe(false);
    // Nor the current one, and bad slugs are refused.
    expect((await changeSlug(db, "s2", "uzitcg")).ok).toBe(false);
    expect((await changeSlug(db, "s2", "login")).ok).toBe(false);

    // Going back reclaims it; the link it left now redirects instead.
    expect((await changeSlug(db, "s1", "pokekade")).ok).toBe(true);
    expect(await movedSlug(db, "pokekade")).toBeNull();
    expect(await movedSlug(db, "uzitcg")).toBe("pokekade");
  });

  it("caps how many old links one store keeps", async () => {
    await addUser("s4");
    await createStore(db, "s4", { name: "Hopper", slug: "hop-0" });
    for (let i = 1; i <= MAX_OLD_SLUGS; i++)
      expect((await changeSlug(db, "s4", `hop-${i}`)).ok).toBe(true);
    expect((await changeSlug(db, "s4", "hop-new")).ok).toBe(false);
    // Returning to an old one is still allowed.
    expect((await changeSlug(db, "s4", "hop-0")).ok).toBe(true);
  });
});
