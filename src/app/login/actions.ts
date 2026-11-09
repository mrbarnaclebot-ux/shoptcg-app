"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { isAdminEmail } from "@/lib/admin";
import { outboxPath } from "@/lib/email";
import { accountExists } from "@/lib/invites";
import { allowMagicLink, clientIp } from "@/lib/sign-in-limit";
import { sendSignInLink } from "@/lib/sign-in-link";

export type LoginState = {
  sent?: string;
  error?: string;
  limited?: boolean;
  failed?: boolean;
};

const emailSchema = z.email().max(254);
const LIMITED: LoginState = {
  error: "Too many links requested. Wait a few minutes.",
  limited: true,
};

// e2e signs in many vendors from one machine; the per-email limit still applies.
async function allowed(email: string, h: Headers) {
  const ip = outboxPath(process.env) ? null : clientIp(h);
  return allowMagicLink(getDb(), email, ip);
}

export async function requestMagicLink(
  _prev: LoginState,
  form: FormData,
): Promise<LoginState> {
  const parsed = emailSchema.safeParse(String(form.get("email") ?? "").trim());
  if (!parsed.success) return { error: "Enter a valid email address" };
  const email = parsed.data.toLowerCase();
  const h = await headers();
  try {
    if (!(await allowed(email, h))) return LIMITED;
    // Same answer either way: this page must not reveal who is a vendor.
    if (isAdminEmail(email) || (await accountExists(getDb(), email)))
      sendSignInLink(email, h);
  } catch (err) {
    // Only the name: a failed query's message can carry the address.
    console.error("[login] request failed", (err as Error).name);
    return {
      error: "Could not send the link. Try again in a minute.",
      failed: true,
    };
  }
  return { sent: email };
}
