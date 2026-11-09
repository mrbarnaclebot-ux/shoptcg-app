import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { store, type Store } from "@/db/schema";
import { createStoreSchema } from "@/lib/slug";

export type FieldErrors = { name?: string; slug?: string; form?: string };

export type CreateStoreResult =
  { ok: true; store: Store } | { ok: false; errors: FieldErrors };

export async function getStoreByOwner(db: Db, ownerUserId: string) {
  const rows = await db
    .select()
    .from(store)
    .where(eq(store.ownerUserId, ownerUserId));
  return rows[0] ?? null;
}

export async function getStoreBySlug(db: Db, slug: string) {
  const rows = await db.select().from(store).where(eq(store.slug, slug));
  return rows[0] ?? null;
}

// Drizzle wraps driver errors; postgres-js and PGlite name the constraint field differently.
function uniqueViolation(err: unknown): string | null {
  const cause = (err as { cause?: Record<string, unknown> })?.cause ?? err;
  const e = cause as Record<string, unknown>;
  if (e?.code !== "23505") return null;
  return String(e.constraint ?? e.constraint_name ?? "");
}

export async function createStore(
  db: Db,
  ownerUserId: string,
  input: unknown,
): Promise<CreateStoreResult> {
  const parsed = createStoreSchema.safeParse(input);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors;
    return {
      ok: false,
      errors: { name: flat.name?.[0], slug: flat.slug?.[0] },
    };
  }
  try {
    const [row] = await db
      .insert(store)
      .values({ ownerUserId, ...parsed.data })
      .returning();
    return { ok: true, store: row };
  } catch (err) {
    // The DB constraints are the source of truth for uniqueness, so races stay safe.
    const constraint = uniqueViolation(err);
    if (constraint === "store_slug_unique")
      return { ok: false, errors: { slug: "That address is taken" } };
    if (constraint === "store_owner_user_id_unique")
      return { ok: false, errors: { form: "You already have a store" } };
    throw err;
  }
}
