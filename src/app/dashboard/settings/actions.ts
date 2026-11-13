"use server";

import { APIError } from "better-auth/api";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { deleteAccount, startEmailChange } from "@/lib/account";
import { isAdminEmail } from "@/lib/admin";
import { getAuth } from "@/lib/auth";
import { appUrl } from "@/lib/deployed";
import { sendAccountDeletedNotice, sendEmailChangeLink } from "@/lib/email";
import { dropImage } from "@/lib/image-store";
import { accountExists } from "@/lib/invites";
import { fieldErrors } from "@/lib/listing-input";
import { newPassword } from "@/lib/password";
import { requireUser } from "@/lib/session";
import { allowMagicLink } from "@/lib/sign-in-limit";
import {
  pricingSchema,
  storeNameSchema,
  tableSchema,
  updateSettings,
} from "@/lib/stores";

export type SettingsState = {
  saved?: true;
  errors?: Record<string, string>;
};

type Schema =
  typeof pricingSchema | typeof tableSchema | typeof storeNameSchema;

/** Saves one settings page: only that page's fields are read and written. */
async function save(schema: Schema, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const parsed = (schema as z.ZodType<z.infer<Schema>>).safeParse(
    Object.fromEntries(form),
  );
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const ok = await updateSettings(getDb(), user.id, parsed.data);
  if (!ok) return { errors: { form: "Create your store first." } };
  refresh();
  return { saved: true };
}

export async function savePricingAction(_prev: SettingsState, form: FormData) {
  return save(pricingSchema, form);
}

export async function saveTableAction(_prev: SettingsState, form: FormData) {
  return save(tableSchema, form);
}

export async function saveNameAction(_prev: SettingsState, form: FormData) {
  return save(storeNameSchema, form);
}

export type PasswordState = { saved?: true; error?: string };

/** Needs the current password; signs out every other device. */
export async function changePasswordAction(
  _prev: PasswordState,
  form: FormData,
): Promise<PasswordState> {
  await requireUser();
  const pw = newPassword(form);
  if (!pw.password) return { error: pw.error };
  const current = String(form.get("current") ?? "");
  if (!current) return { error: "Enter your current password." };
  try {
    const h = await headers();
    await getAuth().api.changePassword({
      body: { currentPassword: current, newPassword: pw.password },
      headers: h,
    });
    // Not changePassword's revokeOtherSessions: that swaps this device's
    // session too, and a server action can't hand back the new cookie.
    await getAuth().api.revokeOtherSessions({ headers: h });
  } catch (err) {
    if (err instanceof APIError)
      return { error: "Your current password isn't right." };
    console.error("[password] change failed", (err as Error).name);
    return { error: "Couldn't save it. Try again in a minute." };
  }
  return { saved: true };
}

/** The signed-in user's password, checked again for a risky change. */
async function passwordOk(password: string, h: Headers) {
  if (!password) return false;
  try {
    await getAuth().api.verifyPassword({ body: { password }, headers: h });
    return true;
  } catch (err) {
    if (err instanceof APIError) return false;
    throw err;
  }
}

export type EmailState = { sent?: string; error?: string; email?: string };

/** Emails a confirm link to the new address; nothing changes until it's opened. */
export async function changeEmailAction(
  _prev: EmailState,
  form: FormData,
): Promise<EmailState> {
  const user = await requireUser();
  const typed = String(form.get("email") ?? "").trim();
  const parsed = z.email().max(254).safeParse(typed);
  if (!parsed.success)
    return { error: "Enter a valid email address", email: typed };
  const to = parsed.data.toLowerCase();
  if (to === user.email)
    return { error: "That's already your email.", email: typed };
  // Admin rights follow the address, so nobody can move into one.
  if (isAdminEmail(to))
    return { error: "That address can't be used.", email: typed };
  const h = await headers();
  try {
    if (!(await passwordOk(String(form.get("current") ?? ""), h)))
      return { error: "Your password isn't right.", email: typed };
    const db = getDb();
    // The same per-address cap as other account emails.
    if (!(await allowMagicLink(db, to, null)))
      return {
        error: "Too many links requested. Wait a few minutes.",
        email: typed,
      };
    if (await accountExists(db, to))
      return { error: "That address already has an account.", email: typed };
    const token = await startEmailChange(db, user.id, to);
    const url = new URL("/login/email", appUrl());
    url.searchParams.set("token", token);
    await sendEmailChangeLink(to, url.toString());
  } catch (err) {
    console.error("[email-change] failed", (err as Error).name);
    return {
      error: "Couldn't send the link. Try again in a minute.",
      email: typed,
    };
  }
  return { sent: to };
}

export type DeleteState = { error?: string };

const CONFIRM = "delete my account";

/** Gone for good: the account, the store and every record under it. */
export async function deleteAccountAction(
  _prev: DeleteState,
  form: FormData,
): Promise<DeleteState> {
  const user = await requireUser();
  if (
    String(form.get("confirm") ?? "")
      .trim()
      .toLowerCase() !== CONFIRM
  )
    return { error: `Type "${CONFIRM}" to confirm.` };
  const h = await headers();
  if (!(await passwordOk(String(form.get("current") ?? ""), h)))
    return { error: "Your password isn't right." };
  let gone;
  try {
    gone = await deleteAccount(getDb(), user.id);
  } catch (err) {
    console.error("[delete-account] failed", (err as Error).name);
    return { error: "Couldn't delete it. Try again in a minute." };
  }
  if (gone) {
    const { email, files } = gone;
    after(async () => {
      for (const f of files) await dropImage(f);
      await sendAccountDeletedNotice(email).catch((err: unknown) =>
        console.error("[delete-account] notice failed", (err as Error).name),
      );
    });
  }
  // The sessions went with the account; the stale cookie just reads as signed out.
  redirect("/login?deleted=1");
}
