import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { store, type Store } from "@/db/schema";
import { createStoreSchema } from "@/lib/slug";

export const SLUG_TAKEN = "That address is taken";

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
      return { ok: false, errors: { slug: SLUG_TAKEN } };
    if (constraint === "store_owner_user_id_unique")
      return { ok: false, errors: { form: "You already have a store" } };
    throw err;
  }
}

/** "B14": the organiser's table number; blank clears it. Mirrors store_table_label_format. */
export const tableLabelSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() || null : v),
  z
    .string()
    .max(8, "8 characters at most")
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only")
    .nullable(),
);

/** Sets the owner's table number; the owner id is the ownership check. */
export async function updateTableLabel(
  db: Db,
  ownerUserId: string,
  tableLabel: string | null,
) {
  const rows = await db
    .update(store)
    .set({ tableLabel })
    .where(eq(store.ownerUserId, ownerUserId))
    .returning({ id: store.id });
  return rows.length > 0;
}

const checkbox = z.preprocess((v) => v === "on" || v === true, z.boolean());

export const settingsSchema = z
  .object({
    priceRulePct: z.coerce
      .number({ error: "Enter a whole number" })
      .int("Enter a whole number")
      .min(-90, "Between -90 and 500")
      .max(500, "Between -90 and 500"),
    rounding: z.enum(["0", "0.5", "1"]),
    secondCurrency: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().toUpperCase() || null : v),
      z
        .string()
        .regex(/^[A-Z]{3}$/, "Use a 3-letter code like AUD")
        .refine((c) => c !== "USD", "Prices are already in USD")
        .nullable(),
    ),
    fxRate: z.preprocess(
      (v) => (typeof v === "string" && !v.trim() ? null : v),
      z.coerce
        .number({ error: "Enter a rate like 1.52" })
        .positive("Rate must be more than 0")
        .max(1_000_000)
        .nullable(),
    ),
    tableLabel: tableLabelSchema,
    nfcEnabled: checkbox,
    isOpen: checkbox,
  })
  .superRefine((v, ctx) => {
    if (v.secondCurrency && v.fxRate === null)
      ctx.addIssue({
        code: "custom",
        path: ["fxRate"],
        message: "Enter your rate for 1 USD",
      });
  });

/** Saves the owner's store settings; the owner id is the ownership check. */
export async function updateSettings(
  db: Db,
  ownerUserId: string,
  input: z.infer<typeof settingsSchema>,
) {
  const fx = input.secondCurrency ? input.fxRate : null;
  const rows = await db
    .update(store)
    .set({
      ...input,
      secondCurrency: fx === null ? null : input.secondCurrency,
      fxRate: fx === null ? null : String(fx),
    })
    .where(eq(store.ownerUserId, ownerUserId))
    .returning({ id: store.id });
  return rows.length > 0;
}
