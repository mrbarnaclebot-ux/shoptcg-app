import { z } from "zod";

export const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"] as const;
export const KINDS = ["raw", "graded", "sealed"] as const;
export const LANGUAGES = ["en", "ja", "zh"] as const;
export type Condition = (typeof CONDITIONS)[number];

// Blank form fields arrive as "" and mean "not set".
const blank = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && !v.trim())
    ? null
    : v;

const optText = (max: number) =>
  z.preprocess(blank, z.string().trim().max(max).nullable());

/** A USD amount as the exact string Postgres numeric(12,2) stores. */
export const priceSchema = z.preprocess(
  (v) => (typeof v === "number" ? String(v) : blank(v)),
  z
    .string()
    .trim()
    .regex(/^\$?\d{1,10}(\.\d{1,2})?$/, "Enter a price like 12.50")
    .transform((v) => Number(v.replace("$", "")).toFixed(2))
    .refine((v) => Number(v) > 0, "Price must be more than 0")
    .nullable(),
);

export const qtySchema = z.coerce
  .number({ error: "Enter a whole number" })
  .int("Enter a whole number")
  .min(0, "Quantity can't be negative")
  .max(9999);

const conditionSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase() || null : v),
  z.enum(CONDITIONS).nullable(),
);

// Raw cards need a condition; slabs and sealed never carry one (the DB agrees).
function conditionForKind<T extends { kind: string; condition: unknown }>(
  v: T,
  ctx: z.RefinementCtx,
) {
  if (v.kind === "raw" && !v.condition)
    ctx.addIssue({
      code: "custom",
      path: ["condition"],
      message: "Pick a condition",
    });
}

const stock = {
  condition: conditionSchema.default(null),
  qty: qtySchema.default(1),
  overridePrice: priceSchema.default(null),
  cost: priceSchema.default(null),
};

export const GRADERS = ["PSA", "BGS", "CGC", "SGC"] as const;
// 10, 9.5, 9 ... 1, as the catalog_item_grade check allows.
export const GRADES = Array.from({ length: 19 }, (_, i) => String(10 - i / 2));

export const catalogListingSchema = z.object({
  catalogItemId: z.uuid(),
  // A raw card listed as a slab: both set, and the graded catalog row is made then.
  grader: z.enum(GRADERS).nullable().default(null),
  grade: z
    .string()
    .refine((g) => GRADES.includes(g), "Pick a grade")
    .nullable()
    .default(null),
  ...stock,
});

export const customListingSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(120),
    setName: optText(120).default(null),
    number: optText(20).default(null),
    kind: z.enum(KINDS),
    language: z.enum(LANGUAGES),
    grader: optText(20).default(null),
    grade: optText(10).default(null),
    imageUrl: z
      .preprocess(
        blank,
        z
          .url({ protocol: /^https$/ })
          .max(500)
          .nullable(),
      )
      .default(null),
    notes: optText(500).default(null),
    ...stock,
  })
  .superRefine(conditionForKind)
  .superRefine((v, ctx) => {
    if (v.kind === "graded" && (!v.grader || !v.grade))
      ctx.addIssue({
        code: "custom",
        path: ["grade"],
        message: "Graded items need a grader and grade",
      });
  });

export type CatalogListingInput = z.infer<typeof catalogListingSchema>;
export type CustomListingInput = z.infer<typeof customListingSchema>;

export const listingPatchSchema = z.object({
  id: z.uuid(),
  qty: qtySchema.optional(),
  condition: conditionSchema.optional(),
  overridePrice: priceSchema.optional(),
  cost: priceSchema.optional(),
  active: z.boolean().optional(),
});

export type ListingPatch = z.infer<typeof listingPatchSchema>;

/** First message per field, for showing next to inputs. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
