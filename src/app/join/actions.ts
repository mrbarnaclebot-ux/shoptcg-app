"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { isAdminEmail } from "@/lib/admin";
import { appUrl } from "@/lib/deployed";
import {
  outboxPath,
  sendInviteRequestAlert,
  sendRequestReceived,
} from "@/lib/email";
import {
  accountExists,
  addInviteRequest,
  codeState,
  hashCode,
  reserveInvite,
  type CodeState,
} from "@/lib/invites";
import {
  allowCodeSend,
  allowInviteRequest,
  allowJoin,
  allowMagicLink,
  clientIp,
} from "@/lib/sign-in-limit";
import { sendInviteLink } from "@/lib/sign-in-link";

export type JoinState = {
  sent?: string;
  /** As typed, for Send again and Use a different email. */
  code?: string;
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
    sendInviteLink(email, h);
  } catch (err) {
    // Only the name: a failed query's message can carry its params.
    console.error("[join] request failed", (err as Error).name);
    return { error: "Something went wrong. Try again in a minute." };
  }
  return { sent: email, code };
}

export type AskState = { sent?: true; error?: string; field?: string };

const askSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.email("Enter a valid email address").max(254),
  about: z.string().trim().max(500).optional(),
});

/** "No code yet?": queues a request for the admin and emails them about it. */
export async function askForInvite(
  _prev: AskState,
  form: FormData,
): Promise<AskState> {
  const parsed = askSchema.safeParse({
    name: form.get("name"),
    email: String(form.get("email") ?? "").trim(),
    about: form.get("about") ?? undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0]) };
  }
  const { name, email, about } = parsed.data;
  const db = getDb();
  const h = await headers();
  const ip = outboxPath(process.env) ? null : clientIp(h);
  try {
    if (!(await allowInviteRequest(db, ip))) return { error: LIMITED };
    const added = await addInviteRequest(db, {
      email,
      name,
      about: about || null,
    });
    // A repeat request gets the same answer and no second alert.
    if (added) {
      const admins = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      const url = new URL("/admin#requests", appUrl()).toString();
      after(() =>
        Promise.all([
          sendRequestReceived(email.toLowerCase()),
          ...admins.map((to) => sendInviteRequestAlert(to, url, name)),
        ]).catch((err: unknown) =>
          console.error("[join] request alert failed", (err as Error).name),
        ),
      );
    }
  } catch (err) {
    console.error("[join] ask failed", (err as Error).name);
    return { error: "Something went wrong. Try again in a minute." };
  }
  return { sent: true };
}
