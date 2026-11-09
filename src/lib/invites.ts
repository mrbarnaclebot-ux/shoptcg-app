import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import { invite, store, user } from "@/db/schema";

const VALID_MS = 14 * 86_400_000;
// Crockford base32: 32 symbols, so 16 characters are 80 bits.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** Rows drawn per list on the admin page, newest first. */
export const SHOWN = 100;

export function generateCode() {
  const chars = Array.from(
    { length: 16 },
    () => ALPHABET[randomInt(ALPHABET.length)],
  ).join("");
  return chars.replace(/(.{4})(?=.)/g, "$1-");
}

/** Forgives case, hyphens, spaces and the letters that look like digits. */
export function normalizeCode(code: string) {
  return code
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

export const hashCode = (code: string) =>
  createHash("sha256").update(normalizeCode(code)).digest("hex");

const active = sql`${invite.usedAt} is null and ${invite.revokedAt} is null and ${invite.expiresAt} > now()`;

/** Returns the code, which is never stored and can't be shown again. */
export async function createInvite(db: Db, label: string | null) {
  const code = generateCode();
  await db.insert(invite).values({
    codeHash: hashCode(code),
    label,
    expiresAt: new Date(Date.now() + VALID_MS),
  });
  return code;
}

export type CodeState = "active" | "used" | "expired" | "revoked" | "unknown";

export async function codeState(db: Db, code: string): Promise<CodeState> {
  const [row] = await db
    .select()
    .from(invite)
    .where(eq(invite.codeHash, hashCode(code)));
  if (!row) return "unknown";
  if (row.usedAt) return "used";
  if (row.revokedAt) return "revoked";
  return row.expiresAt > new Date() ? "active" : "expired";
}

/** Replaces any earlier reservation, so a mistyped email can be corrected. */
export async function reserveInvite(db: Db, code: string, email: string) {
  const rows = await db
    .update(invite)
    .set({ reservedEmail: email.toLowerCase() })
    .where(and(eq(invite.codeHash, hashCode(code)), active))
    .returning({ id: invite.id });
  return rows.length > 0;
}

/** Spends one active invite reserved for this email. Atomic: one winner per invite. */
export async function claimInvite(db: Db, email: string) {
  const rows = await db
    .update(invite)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(
          invite.id,
          sql`(select id from ${invite} where ${invite.reservedEmail} = ${email.toLowerCase()} and ${active} order by ${invite.createdAt} limit 1)`,
        ),
        // Re-checked on the locked row: a racing claim or revoke loses here.
        active,
        eq(invite.reservedEmail, email.toLowerCase()),
      ),
    )
    .returning({ id: invite.id });
  return rows.length > 0;
}

export async function markRedeemed(db: Db, userId: string, email: string) {
  await db
    .update(invite)
    .set({ redeemedBy: userId })
    .where(
      and(
        eq(invite.reservedEmail, email.toLowerCase()),
        isNull(invite.redeemedBy),
        sql`${invite.usedAt} is not null`,
      ),
    );
}

export async function revokeInvite(db: Db, id: string) {
  const rows = await db
    .update(invite)
    .set({ revokedAt: new Date() })
    .where(and(eq(invite.id, id), active))
    .returning({ id: invite.id });
  return rows.length > 0;
}

export type InviteRow = typeof invite.$inferSelect;

export function inviteStatus(i: InviteRow, now = new Date()) {
  if (i.usedAt) return `Used by ${i.reservedEmail}`;
  if (i.revokedAt) return "Revoked";
  if (i.expiresAt <= now) return "Expired";
  return i.reservedEmail ? `Reserved for ${i.reservedEmail}` : "Waiting";
}

export const canRevoke = (i: InviteRow, now = new Date()) =>
  !i.usedAt && !i.revokedAt && i.expiresAt > now;

export function listInvites(db: Db) {
  return db.select().from(invite).orderBy(desc(invite.createdAt)).limit(SHOWN);
}

/** Every account, for reviewing who got in. Read only. */
export function listAccounts(db: Db) {
  return db
    .select({
      id: user.id,
      email: user.email,
      joined: user.createdAt,
      slug: store.slug,
      invite: invite.label,
      invited: sql<boolean>`${invite.id} is not null`,
    })
    .from(user)
    .leftJoin(store, eq(store.ownerUserId, user.id))
    .leftJoin(invite, eq(invite.redeemedBy, user.id))
    .orderBy(desc(user.createdAt))
    .limit(SHOWN);
}

export async function accountExists(db: Db, email: string) {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email.toLowerCase()));
  return rows.length > 0;
}
