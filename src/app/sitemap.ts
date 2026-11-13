import { ne } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getDb } from "@/db";
import { store } from "@/db/schema";
import { appUrl } from "@/lib/deployed";
import { storeState } from "@/lib/store-state";

// Only stores buyers can see now: a store that isn't vending is noindex.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = appUrl();
  const stores = await getDb()
    .select({ slug: store.slug })
    .from(store)
    .where(ne(storeState, "off"));
  return [
    { url: new URL("/", base).href },
    { url: new URL("/help", base).href },
    { url: new URL("/terms", base).href },
    ...stores.map((s) => ({ url: new URL(`/${s.slug}`, base).href })),
  ];
}
