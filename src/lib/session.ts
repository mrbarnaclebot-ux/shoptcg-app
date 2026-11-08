import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth";
import { getStoreByOwner } from "@/lib/stores";

export async function getCurrentUser() {
  // headers() first: it ends prerendering before getAuth() opens the database.
  const h = await headers();
  const session = await getAuth().api.getSession({ headers: h });
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** The signed-in vendor and their store; every inventory query is scoped to store.id. */
export async function requireStore() {
  const user = await requireUser();
  const store = await getStoreByOwner(getDb(), user.id);
  if (!store) redirect("/dashboard");
  return { user, store };
}
