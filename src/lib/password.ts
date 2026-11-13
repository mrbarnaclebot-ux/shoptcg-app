import { and, eq, gt, isNotNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/open";
import { account, user, verification } from "@/db/schema";

export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(128, "At most 128 characters");

/** A new password typed twice; the error is for the form. */
export function newPassword(form: FormData) {
  const pw = String(form.get("password") ?? "");
  const parsed = passwordSchema.safeParse(pw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (pw !== String(form.get("confirm") ?? ""))
    return { error: "The two passwords don't match." };
  return { password: pw };
}

/** Whether this account can sign in with a password yet. */
export async function hasPassword(db: Db, userId: string) {
  const rows = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, "credential"),
        isNotNull(account.password),
      ),
    );
  return rows.length > 0;
}

/** The address a live reset link belongs to, so we can sign them straight in. */
export async function resetTokenEmail(db: Db, token: string) {
  const rows = await db
    .select({ email: user.email })
    .from(verification)
    .innerJoin(user, eq(user.id, verification.value))
    .where(
      and(
        eq(verification.identifier, `reset-password:${token}`),
        gt(verification.expiresAt, new Date()),
      ),
    );
  return rows[0]?.email ?? null;
}
