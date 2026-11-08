"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db";
import { fieldErrors } from "@/lib/listing-input";
import { requireUser } from "@/lib/session";
import { settingsSchema, updateSettings } from "@/lib/stores";

export type SettingsState = {
  saved?: boolean;
  errors?: Record<string, string>;
};

export async function saveSettingsAction(
  _prev: SettingsState,
  form: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const ok = await updateSettings(getDb(), user.id, parsed.data);
  if (!ok) return { errors: { form: "Create your store first." } };
  refresh();
  return { saved: true };
}
