"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { optOut } from "@/lib/sales";

export async function unsubscribe(form: FormData) {
  const token = String(form.get("token"));
  await optOut(getDb(), token);
  redirect(`/u/${encodeURIComponent(token)}?done=1`);
}
