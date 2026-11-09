import { z } from "zod";
import type { PublicFilter, Sort } from "@/lib/storefront";

type Raw = Record<string, string | string[] | undefined>;

// .catch drops anything unknown, so a hand-edited URL never errors.
const one = <T extends z.ZodType>(t: T) =>
  z.preprocess(
    (v) => (Array.isArray(v) ? v[0] : v),
    t.optional().catch(undefined),
  );

const filterSchema = z.object({
  type: one(z.enum(["raw", "graded", "sealed"])),
  lang: z
    .preprocess((v) => (v === undefined ? [] : [v].flat()), z.array(z.string()))
    .transform((a) =>
      [...new Set(a)].filter((l): l is "en" | "ja" | "zh" =>
        ["en", "ja", "zh"].includes(l),
      ),
    )
    .catch([]),
  q: one(z.string().transform((s) => s.trim().slice(0, 60) || undefined)),
  sort: one(z.enum(["price-desc", "price-asc", "name", "new"])),
});

export function parseFilter(raw: Raw): PublicFilter {
  const f = filterSchema.parse(raw);
  return { type: f.type, langs: f.lang, q: f.q, sort: f.sort };
}

/** The store URL for a filter, with defaults left out so links stay short. */
export function filterHref(slug: string, f: PublicFilter) {
  const p = new URLSearchParams();
  if (f.type) p.set("type", f.type);
  for (const l of f.langs ?? []) p.append("lang", l);
  if (f.q) p.set("q", f.q);
  if (f.sort && f.sort !== "price-desc") p.set("sort", f.sort);
  const qs = p.toString();
  return qs ? `/${slug}?${qs}` : `/${slug}`;
}

export const SORT_LABEL: Record<Sort, string> = {
  "price-desc": "Price high to low",
  "price-asc": "Price low to high",
  name: "Name",
  new: "Newest",
};

export const parseRange = (raw: Raw) =>
  one(z.enum(["30", "90"])).parse(raw.range) === "90" ? 90 : 30;
