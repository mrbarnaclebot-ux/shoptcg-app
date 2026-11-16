import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, like } from "drizzle-orm";
import type { Db } from "@/db/open";
import { listing, store, user, verification } from "@/db/schema";

const CHANGE_MS = 60 * 60_000;
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const key = (token: string) => `change-email:${hash(token)}`;

/**
 * A link for the new address to prove it's theirs. Only the token's hash is
 * stored, in Better Auth's verification table; a newer request replaces it.
 */
export async function startEmailChange(
  db: Db,
  userId: string,
  newEmail: string,
) {
  const token = randomBytes(32).toString("base64url");
  await db.transaction(async (tx) => {
    // One pending change per account: older links stop working.
    await tx
      .delete(verification)
      .where(
        and(
          like(verification.identifier, "change-email:%"),
          like(verification.value, `${userId} %`),
        ),
      );
    await tx.insert(verification).values({
      id: randomUUID(),
      identifier: key(token),
      value: `${userId} ${newEmail.toLowerCase()}`,
      expiresAt: new Date(Date.now() + CHANGE_MS),
    });
  });
  return token;
}

export type EmailChange =
  | { ok: true; from: string; to: string }
  | { ok: false; why: "expired" | "taken" };

/** Spends the link and moves the account to the new address. */
export async function confirmEmailChange(
  db: Db,
  token: string,
): Promise<EmailChange> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .delete(verification)
      .where(
        and(
          eq(verification.identifier, key(token)),
          gt(verification.expiresAt, new Date()),
        ),
      )
      .returning({ value: verification.value });
    if (!row) return { ok: false, why: "expired" };
    const [userId, to] = row.value.split(" ");
    const [owner] = await tx
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId));
    if (!owner) return { ok: false, why: "expired" };
    const [taken] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, to));
    if (taken) return { ok: false, why: "taken" };
    await tx
      .update(user)
      .set({ email: to, emailVerified: true, updatedAt: new Date() })
      .where(eq(user.id, userId));
    return { ok: true, from: owner.email, to };
  });
}

/**
 * Removes the account and, by cascade, its store, stock, sales, buys, buyer
 * requests and sessions. Returns the store's and its items' image file ids so the caller can
 * drop them from storage after the rows are gone.
 */
export async function deleteAccount(db: Db, userId: string) {
  return db.transaction(async (tx) => {
    const [s] = await tx
      .select({ banner: store.bannerFileId, avatar: store.avatarFileId })
      .from(store)
      .where(eq(store.ownerUserId, userId));
    const photos = s
      ? await tx
          .select({ id: listing.imageFileId })
          .from(listing)
          .innerJoin(store, eq(store.id, listing.storeId))
          .where(eq(store.ownerUserId, userId))
      : [];
    const [gone] = await tx
      .delete(user)
      .where(eq(user.id, userId))
      .returning({ email: user.email });
    return gone
      ? {
          email: gone.email,
          files: [s?.banner, s?.avatar, ...photos.map((p) => p.id)].filter(
            Boolean,
          ),
        }
      : null;
  });
}
