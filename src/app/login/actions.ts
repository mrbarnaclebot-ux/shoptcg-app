"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getAuth } from "@/lib/auth";

export type LoginState = { sent?: string; error?: string };

const emailSchema = z.email().max(254);

export async function requestMagicLink(
  _prev: LoginState,
  form: FormData,
): Promise<LoginState> {
  const parsed = emailSchema.safeParse(String(form.get("email") ?? "").trim());
  if (!parsed.success) return { error: "Enter a valid email address" };
  try {
    await getAuth().api.signInMagicLink({
      body: { email: parsed.data, callbackURL: "/dashboard" },
      headers: await headers(),
    });
  } catch (err) {
    console.error("[login] magic link failed", err);
    return { error: "Could not send the link. Try again in a minute." };
  }
  return { sent: parsed.data };
}
