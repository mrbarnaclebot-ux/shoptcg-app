"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { newPassword } from "@/lib/password";
import { requireUser } from "@/lib/session";

export type WelcomeState = { error?: string };

/** The first password for an account made by an invite link, or an old link-only one. */
export async function setPasswordAction(
  _prev: WelcomeState,
  form: FormData,
): Promise<WelcomeState> {
  await requireUser();
  const pw = newPassword(form);
  if (!pw.password) return { error: pw.error };
  try {
    await getAuth().api.setPassword({
      body: { newPassword: pw.password },
      headers: await headers(),
    });
  } catch (err) {
    if (!(err instanceof APIError)) {
      console.error("[welcome] failed", (err as Error).name);
      return { error: "Couldn't save it. Try again in a minute." };
    }
    // Setting a first password needs a session from the last day.
    if (err.body?.code === "SESSION_NOT_FRESH")
      return {
        error:
          "For safety, set it from an emailed link: sign out, then use Forgot password.",
      };
    // PASSWORD_ALREADY_SET (a second tab): nothing left to do.
  }
  redirect("/dashboard");
}
