"use server";

import { refresh } from "next/cache";
import type { z } from "zod";
import { getDb } from "@/db";
import { fieldErrors } from "@/lib/listing-input";
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
