"use server";

import { APIError } from "better-auth/api";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import type { z } from "zod";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth";
import { fieldErrors } from "@/lib/listing-input";
import { newPassword } from "@/lib/password";
import { requireUser } from "@/lib/session";
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
