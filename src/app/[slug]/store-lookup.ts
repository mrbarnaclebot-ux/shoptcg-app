import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db";
import { slugSchema } from "@/lib/slug";
import { getPublicStore } from "@/lib/storefront";

/** The slug's store or a 404; shared by the page and its metadata. */
export const storeOr404 = cache(async (slug: string) => {
  // Skip the DB for anything that could never be a store slug.
  if (!slugSchema.safeParse(slug).success) notFound();
  // Stock and open state change by the minute, so never prerender.
  await connection();
  const store = await getPublicStore(getDb(), slug);
  if (!store) notFound();
  return store;
});
