import { Search } from "lucide-react";
import { z } from "zod";
import { ContinuousTabs } from "@/components/continuous-tabs";
import { SortMenu } from "@/components/sort-menu";
import { Input } from "@/components/ui/input";
import type { StockSort } from "@/lib/listings";

// Unknown values fall back to "no filter" instead of erroring on a hand-edited URL.
export const filterSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  kind: z
    .enum(["raw", "graded", "sealed", "other", "hidden", "removed"])
    .optional()
    .catch(undefined),
  language: z.enum(["en", "ja", "zh"]).optional().catch(undefined),
  sort: z
    .enum(["new", "name", "price-desc", "price-asc", "qty"])
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});
export type Filter = z.infer<typeof filterSchema>;

const KINDS = [
  [undefined, "All"],
  ["raw", "Raw"],
  ["graded", "Graded"],
  ["sealed", "Sealed"],
  ["other", "Other"],
  ["hidden", "Hidden"],
  ["removed", "Removed"],
] as const;
const LANGS = [
  [undefined, "Any language"],
  ["en", "EN"],
  ["ja", "JP"],
  ["zh", "CN"],
] as const;
const SORTS: [StockSort | undefined, string][] = [
  [undefined, "Newest"],
  ["name", "Name"],
  ["price-desc", "Price high to low"],
  ["price-asc", "Price low to high"],
  ["qty", "Quantity"],
];

/** The inventory URL for this filter; any change but the page starts at page 1. */
export function href(filter: Filter, patch: Partial<Filter>) {
  const next = { ...filter, page: undefined, ...patch };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next))
    if (v && !(k === "page" && v === 1)) qs.set(k, String(v));
  return qs.size ? `/dashboard/inventory?${qs}` : "/dashboard/inventory";
}

// A GET form, so search works before hydration and the URL is shareable.
export function Filters({ filter }: { filter: Filter }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <form role="search" className="relative min-w-64 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            name="q"
            type="search"
            defaultValue={filter.q}
            placeholder="Search your stock"
            aria-label="Search your stock"
            className="pl-11"
          />
          {(["kind", "language", "sort"] as const).map(
            (k) =>
              filter[k] && (
                <input key={k} type="hidden" name={k} value={filter[k]} />
              ),
          )}
        </form>
        <SortMenu
          options={SORTS.map(([sort, label]) => ({
            label,
            href: href(filter, { sort }),
            on: filter.sort === sort,
          }))}
        />
      </div>
      {/* On phones the row scrolls; the fade says there is more to the right. */}
      <div className="-mx-4 flex gap-8 overflow-x-auto py-0.5 pr-8 pl-4 [mask-image:linear-gradient(to_right,#000_calc(100%_-_2rem),transparent)] md:mx-0 md:flex-wrap md:px-0 md:[mask-image:none]">
        <ContinuousTabs
          id="kind"
          label="Type"
          tabs={KINDS.map(([kind, label]) => ({
            label,
            href: href(filter, { kind }),
            on: filter.kind === kind,
          }))}
        />
        <ContinuousTabs
          id="language"
          label="Language"
          tabs={LANGS.map(([language, label]) => ({
            label,
            href: href(filter, { language }),
            on: filter.language === language,
          }))}
        />
      </div>
    </div>
  );
}
