"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/session";
import { tableLabelSchema, updateTableLabel } from "@/lib/stores";

export type TableState = { saved?: string | null; error?: string };

export async function saveTableLabelAction(
  _prev: TableState,
  form: FormData,
): Promise<TableState> {
  const user = await requireUser();
  const parsed = tableLabelSchema.safeParse(form.get("tableLabel"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await updateTableLabel(getDb(), user.id, parsed.data)))
    return { error: "Create your store first." };
  refresh();
  return { saved: parsed.data };
}
