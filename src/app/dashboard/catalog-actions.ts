"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { chargeMiss, searchCatalog } from "@/lib/catalog";
import { SearchError } from "@/lib/pricing/errors";
import { defaultProvider } from "@/lib/pricing/provider";
import { requireUser } from "@/lib/session";

const searchInput = z.object({
  query: z.string().trim().min(1).max(100),
  kind: z.enum(["raw", "graded", "sealed"]),
  language: z.enum(["en", "ja", "zh"]),
  // "Search more": skip the local cache and ask the provider.
  force: z.boolean().default(false),
});

// Any signed-in user may search (signup is open), so every cache miss is
// charged against that user's hourly limit; cache hits are free.
export async function searchCatalogAction(input: unknown) {
  const user = await requireUser();
  const { query, kind, language, force } = searchInput.parse(input);
  const db = getDb();
  try {
    const items = await searchCatalog(
      db,
      query,
      { kind, language, force },
      defaultProvider(),
      () => chargeMiss(db, user.id),
    );
    return { items };
  } catch (err) {
    // Next hides thrown messages in production, so return the friendly ones.
    if (err instanceof SearchError) return { items: [], error: err.message };
    throw err;
  }
}
