import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { describe, expect, test } from "vitest";
import type { Db } from "@/db/open";
import * as schema from "@/db/schema";
import { invite } from "@/db/schema";
import { isAdminEmail } from "@/lib/admin";
import {
  claimInvite,
  codeState,
  createInvite,
  generateCode,
  hashCode,
  inviteStatus,
  markRedeemed,
  normalizeCode,
  reserveInvite,
  revokeInvite,
} from "@/lib/invites";
import { migratedDb } from "@/lib/test-fixtures";

test("codes are 80 bits in readable groups, and forgive how they're typed", () => {
  const code = generateCode();
  expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  expect(new Set(Array.from({ length: 200 }, generateCode)).size).toBe(200);
  expect(hashCode(code.toLowerCase().replaceAll("-", " "))).toBe(
    hashCode(code),
  );
  expect(normalizeCode("o1il-0")).toBe("01110");
  expect(hashCode(code)).toMatch(/^[0-9a-f]{64}$/);
});

test("admin emails ignore case and spaces; empty never matches", () => {
  const env = { ADMIN_EMAILS: " Owner@Example.test , b@x.test" };
  expect(isAdminEmail("owner@example.TEST", env)).toBe(true);
  expect(isAdminEmail("b@x.test", env)).toBe(true);
  expect(isAdminEmail("c@x.test", env)).toBe(false);
  expect(isAdminEmail("", { ADMIN_EMAILS: "a@x.test," })).toBe(false);
  expect(isAdminEmail("a@x.test", {})).toBe(false);
});

const email = () => `v-${randomUUID().slice(0, 8)}@example.test`;

function suite(name: string, open: () => Promise<Db>) {
  describe(name, () => {
    test("only the hash is stored; a reserved invite is claimed once", async () => {
      const db = await open();
      const code = await createInvite(db, "Sam");
      const rows = await db
        .select()
        .from(invite)
        .where(eq(invite.codeHash, hashCode(code)));
      expect(JSON.stringify(rows)).not.toContain(normalizeCode(code));
      const who = email();
      expect(await claimInvite(db, who)).toBe(false);
      expect(await reserveInvite(db, code, who.toUpperCase())).toBe(true);
      expect(await claimInvite(db, who)).toBe(true);
      expect(await claimInvite(db, who)).toBe(false);
      expect(await codeState(db, code)).toBe("used");
      expect(await reserveInvite(db, code, email())).toBe(false);
    });

    test("a typo can be corrected until the invite is used", async () => {
      const db = await open();
      const code = await createInvite(db, null);
      const typo = email();
      const right = email();
      await reserveInvite(db, code, typo);
      await reserveInvite(db, code, right);
      expect(await claimInvite(db, typo)).toBe(false);
      expect(await claimInvite(db, right)).toBe(true);
    });

    test("expired, revoked and unknown codes can't be reserved or claimed", async () => {
      const db = await open();
      expect(await codeState(db, generateCode())).toBe("unknown");
      const old = await createInvite(db, null);
      const who = email();
      await reserveInvite(db, old, who);
      await db
        .update(invite)
        .set({ expiresAt: sql`now() - interval '1 second'` })
        .where(eq(invite.codeHash, hashCode(old)));
      expect(await codeState(db, old)).toBe("expired");
      expect(await claimInvite(db, who)).toBe(false);

      const gone = await createInvite(db, null);
      const other = email();
      await reserveInvite(db, gone, other);
      const [{ id }] = await db
        .select({ id: invite.id })
        .from(invite)
        .where(eq(invite.codeHash, hashCode(gone)));
      expect(await revokeInvite(db, id)).toBe(true);
      expect(await revokeInvite(db, id)).toBe(false);
      expect(await codeState(db, gone)).toBe("revoked");
      // A link already sent can't create the account any more.
      expect(await claimInvite(db, other)).toBe(false);
    });

    test("statuses read the way the admin page shows them", async () => {
      const db = await open();
      const code = await createInvite(db, "Lee");
      const row = async () =>
        (
          await db
            .select()
            .from(invite)
            .where(eq(invite.codeHash, hashCode(code)))
        )[0];
      expect(inviteStatus(await row())).toBe("Waiting");
      const who = email();
      await reserveInvite(db, code, who);
      expect(inviteStatus(await row())).toBe(`Reserved for ${who}`);
      await claimInvite(db, who);
      const userId = randomUUID();
      await db.insert(schema.user).values({ id: userId, name: "", email: who });
      await markRedeemed(db, userId, who);
      const used = await row();
      expect(inviteStatus(used)).toBe(`Used by ${who}`);
      expect(used.redeemedBy).toBe(userId);
      // Deleting the account keeps the invite's history.
      await db.delete(schema.user).where(eq(schema.user.id, userId));
      expect((await row()).redeemedBy).toBeNull();
    });
  });
}

suite("PGlite", migratedDb);

// CI sets DATABASE_URL to a real Postgres, where the claims truly overlap.
const url = process.env.DATABASE_URL;
describe.runIf(Boolean(url))("Postgres", () => {
  const open = async () => {
    const db = drizzle(postgres(url!, { max: 6, onnotice: () => {} }), {
      schema,
    });
    await migrate(db, { migrationsFolder: "drizzle" });
    return db as unknown as Db;
  };
  suite("concurrent", open);

  /**
   * Holds the invite's row lock while `racers` start, so they all pick the row
   * from the same snapshot and queue on it: a real overlap, every run.
   */
  async function queued<T>(db: Db, code: string, racers: () => Promise<T>[]) {
    const holder = postgres(url!, { max: 1, onnotice: () => {} });
    let results!: Promise<T[]>;
    await holder.begin(async (tx) => {
      await tx`select id from invite where code_hash = ${hashCode(code)} for update`;
      results = Promise.all(racers());
      await new Promise((r) => setTimeout(r, 300));
    });
    await holder.end();
    return results;
  }

  test("links racing for one invite make one account", async () => {
    const db = await open();
    const code = await createInvite(db, null);
    const who = email();
    await reserveInvite(db, code, who);
    const wins = await queued(db, code, () =>
      Array.from({ length: 4 }, () => claimInvite(db, who)),
    );
    expect(wins.filter(Boolean)).toHaveLength(1);
  });

  test("a revoke racing a claim leaves the invite either used or revoked", async () => {
    const db = await open();
    const code = await createInvite(db, null);
    const who = email();
    await reserveInvite(db, code, who);
    const [{ id }] = await db
      .select({ id: invite.id })
      .from(invite)
      .where(eq(invite.codeHash, hashCode(code)));
    // Revoke queues first: a claim behind it must see the revoke, not win too.
    const [revoked, claimed] = await queued(db, code, () => [
      revokeInvite(db, id),
      claimInvite(db, who),
    ]);
    expect(claimed !== revoked).toBe(true);
  });
});
