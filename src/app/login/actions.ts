"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { isAdminEmail } from "@/lib/admin";
import { getAuth } from "@/lib/auth";
import { outboxPath } from "@/lib/email";
import { accountExists } from "@/lib/invites";
import { newPassword, resetTokenEmail } from "@/lib/password";
import {
  allowMagicLink,
  allowPasswordTry,
  clientIp,
} from "@/lib/sign-in-limit";
import { sendInviteLink, sendResetLink } from "@/lib/sign-in-link";

export type LoginState = { error?: string; email?: string };
export type ForgotState = { sent?: string; error?: string };
export type ResetState = { error?: string; expired?: true };

const emailSchema = z.email().max(254);
const WRONG = "Wrong email or password.";

// e2e signs in many vendors from one machine; the per-email limits still apply.
async function ip() {
  const h = await headers();
  return { h, ip: outboxPath(process.env) ? null : clientIp(h) };
}

export async function signInAction(
  _prev: LoginState,
  form: FormData,
): Promise<LoginState> {
  const typed = String(form.get("email") ?? "").trim();
  const parsed = emailSchema.safeParse(typed);
  const password = String(form.get("password") ?? "");
  if (!parsed.success || !password || password.length > 128)
    return { error: WRONG, email: typed };
  const email = parsed.data.toLowerCase();
  const { h, ip: addr } = await ip();
  try {
    if (!(await allowPasswordTry(getDb(), email, addr)))
      return {
        error: "Too many tries. Wait 15 minutes, or reset your password.",
        email: typed,
      };
    // nextCookies() sets the session cookie on this response.
    await getAuth().api.signInEmail({
      body: { email, password, rememberMe: true },
      headers: h,
    });
  } catch (err) {
    if (err instanceof APIError) return { error: WRONG, email: typed };
    // Only the name: a failed query's message can carry the address.
    console.error("[login] failed", (err as Error).name);
    return { error: "Couldn't sign in. Try again in a minute.", email: typed };
  }
  redirect("/dashboard");
}

/** Emails a set-password link. Same answer whether or not the account exists. */
export async function forgotAction(
  _prev: ForgotState,
  form: FormData,
): Promise<ForgotState> {
  const parsed = emailSchema.safeParse(String(form.get("email") ?? "").trim());
  if (!parsed.success) return { error: "Enter a valid email address" };
  const email = parsed.data.toLowerCase();
  const { h, ip: addr } = await ip();
  try {
    if (!(await allowMagicLink(getDb(), email, addr)))
      return { error: "Too many links requested. Wait a few minutes." };
    if (await accountExists(getDb(), email)) sendResetLink(email, h);
    // An admin's first visit: no account yet, and admins need no invite.
    else if (isAdminEmail(email)) sendInviteLink(email, h);
  } catch (err) {
    console.error("[forgot] request failed", (err as Error).name);
    return { error: "Could not send the link. Try again in a minute." };
  }
  return { sent: email };
}

/** Sets the new password from an emailed link, then signs straight in. */
export async function resetAction(
  _prev: ResetState,
  form: FormData,
): Promise<ResetState> {
  const token = String(form.get("token") ?? "");
  const pw = newPassword(form);
  if (!pw.password) return { error: pw.error };
  const { h } = await ip();
  const db = getDb();
  const email = token ? await resetTokenEmail(db, token) : null;
  if (!email)
    return {
      error: "That link has expired or was already used.",
      expired: true,
    };
  try {
    await getAuth().api.resetPassword({
      body: { newPassword: pw.password, token },
      headers: h,
    });
  } catch (err) {
    if (err instanceof APIError)
      return {
        error: "That link has expired or was already used.",
        expired: true,
      };
    console.error("[reset] failed", (err as Error).name);
    return { error: "Couldn't save it. Try again in a minute." };
  }
  try {
    await getAuth().api.signInEmail({
      body: { email, password: pw.password, rememberMe: true },
      headers: h,
    });
  } catch {
    redirect("/login?reset=1");
  }
  redirect("/dashboard");
}
