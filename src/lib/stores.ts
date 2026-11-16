import { eq, getTableColumns, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { store, type Store } from "@/db/schema";
import { SELLING_MODES } from "@/lib/selling-mode";
import { createStoreSchema } from "@/lib/slug";
import {
  autoPaused,
  changesInMs,
  resumesInMin,
  storeState,
  type StoreState,
} from "@/lib/store-state";

export const SLUG_TAKEN = "That address is taken";

export type FieldErrors = { name?: string; slug?: string; form?: string };

export type CreateStoreResult =
  { ok: true; store: Store } | { ok: false; errors: FieldErrors };

/** The owner's store, with what buyers get now (live) next to what was chosen (state). */
export async function getStoreByOwner(db: Db, ownerUserId: string) {
  const rows = await db
    .select({
      ...getTableColumns(store),
      live: storeState,
      resumesInMin,
      changesInMs,
      autoPaused,
    })
    .from(store)
    .where(eq(store.ownerUserId, ownerUserId));
  return rows[0] ?? null;
}

export async function getStoreBySlug(db: Db, slug: string) {
  const rows = await db.select().from(store).where(eq(store.slug, slug));
  return rows[0] ?? null;
}

// Drizzle wraps driver errors; postgres-js and PGlite name the constraint field differently.
export function uniqueViolation(err: unknown): string | null {
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

const conditionPctField = z.coerce
  .number({ error: "Enter a whole number" })
  .int("Enter a whole number")
  .min(1, "Between 1 and 100")
  .max(100, "Between 1 and 100");

const pricingFields = z.object({
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
  condLpPct: conditionPctField,
  condMpPct: conditionPctField,
  condHpPct: conditionPctField,
  condDmgPct: conditionPctField,
});

/** The Pricing settings page: the price rule, rounding and second currency. */
export const pricingSchema = pricingFields.superRefine((v, ctx) => {
  if (v.secondCurrency && v.fxRate === null)
    ctx.addIssue({
      code: "custom",
      path: ["fxRate"],
      message: "Enter your rate for 1 USD",
    });
});

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || null : (v ?? null)),
    z.string().max(max, `${max} characters at most`).nullable(),
  );

/** "+94 77 123 4567" as wa.me wants it, "94771234567"; blank is none. */
export const whatsappSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/[\s()+-]/g, "") || null : null),
  z
    .string()
    .regex(
      /^[1-9][0-9]{7,14}$/,
      "Start with the country code, like +94 77 123 4567",
    )
    .nullable(),
);

/** The How you sell settings page, with the online checkout options. */
export const tableSchema = z
  .object({
    sellingMode: z.enum(SELLING_MODES),
    tableLabel: tableLabelSchema,
    nfcEnabled: checkbox,
    offerDelivery: checkbox,
    offerPickup: checkbox,
    acceptCash: checkbox,
    acceptTransfer: checkbox,
    bankDetails: optionalText(500),
    checkoutNote: optionalText(300),
    whatsapp: whatsappSchema,
  })
  .superRefine((v, ctx) => {
    if (v.acceptTransfer && !v.bankDetails)
      ctx.addIssue({
        code: "custom",
        path: ["bankDetails"],
        message: "Add the account buyers transfer to",
      });
  });

export const storeNameSchema = createStoreSchema.pick({ name: true });

/**
 * Opens, pauses (for pauseMs, or until reopened when null) or closes the owner's
 * store; false when they have none. Opening starts a fresh 14-hour window.
 */
export async function setStoreState(
  db: Db,
  ownerUserId: string,
  state: StoreState,
  pauseMs: number | null = null,
) {
  const rows = await db
    .update(store)
    .set({
      state,
      openedAt: state === "open" ? sql`now()` : undefined,
      pausedUntil:
        state === "paused" && pauseMs
          ? sql`now() + ${pauseMs} * interval '1 millisecond'`
          : null,
    })
    .where(eq(store.ownerUserId, ownerUserId))
    .returning({ id: store.id });
  return rows.length > 0;
}

/** Saves one settings page's fields; the owner id is the ownership check. */
export async function updateSettings(
  db: Db,
  ownerUserId: string,
  input:
    | z.infer<typeof pricingSchema>
    | z.infer<typeof tableSchema>
    | z.infer<typeof storeNameSchema>,
) {
  // A rate without a currency means nothing, so both clear together.
  const fx = "fxRate" in input && input.secondCurrency ? input.fxRate : null;
  const set =
    "fxRate" in input
      ? {
          ...input,
          secondCurrency: fx === null ? null : input.secondCurrency,
          fxRate: fx === null ? null : String(fx),
        }
      : input;
  const rows = await db
    .update(store)
    .set(set)
    .where(eq(store.ownerUserId, ownerUserId))
    .returning({ id: store.id });
  return rows.length > 0;
}

/**
 * Sets or clears (null) the store's banner or profile image. Returns the file
 * id it replaced, so the caller can delete that file from storage.
 */
export async function setStoreImage(
  db: Db,
  storeId: string,
  kind: "banner" | "avatar",
  image: { url: string; fileId: string | null } | null,
) {
  const url = image?.url ?? null;
  const fileId = image?.fileId ?? null;
  return db.transaction(async (tx) => {
    const [old] = await tx
      .select({ banner: store.bannerFileId, avatar: store.avatarFileId })
      .from(store)
      .where(eq(store.id, storeId))
      .for("update");
    await tx
      .update(store)
      .set(
        kind === "banner"
          ? { bannerUrl: url, bannerFileId: fileId }
          : { avatarUrl: url, avatarFileId: fileId },
      )
      .where(eq(store.id, storeId));
    return old?.[kind] ?? null;
  });
}

/** An admin's stop: while set, the store reads as "off" to everyone. False if no such store. */
export async function setSuspended(db: Db, storeId: string, on: boolean) {
  const rows = await db
    .update(store)
    .set({ suspendedAt: on ? sql`now()` : null })
    .where(eq(store.id, storeId))
    .returning({ id: store.id });
  return rows.length > 0;
}

/** Hides the getting-started tips for good. */
export async function dismissTips(db: Db, ownerUserId: string) {
  await db
    .update(store)
    .set({ tipsDismissedAt: sql`now()` })
    .where(eq(store.ownerUserId, ownerUserId));
}
