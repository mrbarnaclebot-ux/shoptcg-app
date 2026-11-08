"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { createStore, SLUG_TAKEN, type FieldErrors } from "@/lib/stores";

export type CreateStoreState = { errors?: FieldErrors; taken?: string };

export async function createStoreAction(
  _prev: CreateStoreState,
  form: FormData,
): Promise<CreateStoreState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const result = await createStore(getDb(), user.id, {
    name: form.get("name"),
    slug: form.get("slug"),
  });
  if (!result.ok) {
    const slug = String(form.get("slug"));
    const taken = result.errors.slug === SLUG_TAKEN ? slug : undefined;
    return { errors: result.errors, taken };
  }
  // The dashboard plays the store-created moment once, then drops the flag.
  redirect("/dashboard?created=1");
}

export async function signOutAction() {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/");
}
