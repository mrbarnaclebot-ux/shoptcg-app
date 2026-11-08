"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { searchCatalog } from "@/lib/catalog";
import { requireUser } from "@/lib/session";

const searchInput = z.object({
  query: z.string().trim().min(1).max(100),
  kind: z.enum(["raw", "graded", "sealed"]),
  language: z.enum(["en", "ja", "zh"]),
});

// Vendors only: every cache miss spends PPT credits.
export async function searchCatalogAction(input: unknown) {
  await requireUser();
  const { query, kind, language } = searchInput.parse(input);
  return searchCatalog(getDb(), query, { kind, language });
}
