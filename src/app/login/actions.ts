"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth";
import { outboxPath } from "@/lib/email";
import { allowMagicLink, clientIp } from "@/lib/sign-in-limit";

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
  const h = await headers();
  try {
    if (!(await allowed(parsed.data, h))) return LIMITED;
    await getAuth().api.signInMagicLink({
      body: {
        email: parsed.data,
        callbackURL: "/dashboard",
        errorCallbackURL: "/login?link=expired",
      },
      headers: h,
    });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 429) return LIMITED;
    console.error("[login] magic link failed", err);
    return {
      error: "Could not send the link. Try again in a minute.",
      failed: true,
    };
  }
  return { sent: parsed.data };
}
