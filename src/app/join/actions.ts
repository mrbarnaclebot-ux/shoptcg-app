"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { isAdminEmail } from "@/lib/admin";
import { outboxPath } from "@/lib/email";
import {
  accountExists,
  codeState,
  hashCode,
  reserveInvite,
  type CodeState,
} from "@/lib/invites";
import {
  allowCodeSend,
  allowJoin,
  allowMagicLink,
  clientIp,
} from "@/lib/sign-in-limit";
import { sendSignInLink } from "@/lib/sign-in-link";

export type JoinState = {
  sent?: string;
  error?: string;
  field?: "code" | "email";
};

const BAD: Record<Exclude<CodeState, "active">, string> = {
  unknown: "That code isn't right. Check it and try again.",
  used: "That code has already been used. Ask for a new one.",
  expired: "That code has expired. Ask for a new one.",
  revoked: "That code was cancelled. Ask for a new one.",
};
const LIMITED = "Too many tries. Wait a while, then try again.";
const emailSchema = z.email().max(254);

export async function requestInvite(
  _prev: JoinState,
  form: FormData,
): Promise<JoinState> {
  const code = String(form.get("code") ?? "").trim();
  if (!code || code.length > 64)
    return { error: "Enter your invite code.", field: "code" };
  const parsed = emailSchema.safeParse(String(form.get("email") ?? "").trim());
  if (!parsed.success)
    return { error: "Enter a valid email address", field: "email" };
  const email = parsed.data.toLowerCase();
  const db = getDb();
  const h = await headers();
  // e2e joins many vendors from one machine.
  const ip = outboxPath(process.env) ? null : clientIp(h);
  try {
    if (!(await allowJoin(db, ip))) return { error: LIMITED };
    const state = await codeState(db, code);
    if (state !== "active") return { error: BAD[state], field: "code" };
    if (!(await allowMagicLink(db, email, ip, false)))
      return { error: LIMITED };
    if (!(await allowCodeSend(db, hashCode(code)))) return { error: LIMITED };
    const known = isAdminEmail(email) || (await accountExists(db, email));
    // Someone with an account just signs in; their code stays unused.
    if (!known && !(await reserveInvite(db, code, email))) {
      const now = await codeState(db, code);
      return { error: BAD[now === "active" ? "unknown" : now], field: "code" };
    }
    sendSignInLink(email, h);
  } catch (err) {
    // Only the name: a failed query's message can carry its params.
    console.error("[join] request failed", (err as Error).name);
    return { error: "Something went wrong. Try again in a minute." };
  }
  return { sent: email };
}
