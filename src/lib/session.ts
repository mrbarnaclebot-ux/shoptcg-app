import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth";
import { safeTimeZone } from "@/lib/format";
import { postgresZone } from "@/lib/request-reads";
import { getStoreByOwner } from "@/lib/stores";

export async function getCurrentUser() {
  // headers() first: it ends prerendering before getAuth() opens the database.
  const h = await headers();
  const session = await getAuth().api.getSession({ headers: h });
  return session?.user ?? null;
}

/** The seller's zone from their browser's cookie; UTC until it has set one. */
export async function sellerTimeZone() {
  const zone = safeTimeZone((await cookies()).get("tz")?.value);
  return postgresZone(getDb(), zone);
}

/** For route handlers, which answer 401 rather than redirect. */
export async function storeOrNull() {
  const user = await getCurrentUser();
  return user && getStoreByOwner(getDb(), user.id);
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
