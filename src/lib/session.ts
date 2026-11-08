import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

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
