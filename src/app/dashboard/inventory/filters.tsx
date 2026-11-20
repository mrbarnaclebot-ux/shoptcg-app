import { Search } from "lucide-react";
import { z } from "zod";
import { ContinuousTabs } from "@/components/continuous-tabs";
import { Input } from "@/components/ui/input";

// Unknown values fall back to "no filter" instead of erroring on a hand-edited URL.
export const filterSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  kind: z
    .enum(["raw", "graded", "sealed", "other", "hidden", "removed"])
    .optional()
    .catch(undefined),
  language: z.enum(["en", "ja", "zh"]).optional().catch(undefined),
});
type Filter = z.infer<typeof filterSchema>;

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

function href(filter: Filter, patch: Partial<Filter>) {
  const next = { ...filter, ...patch };
  const qs = new URLSearchParams(
    Object.entries(next).filter((e): e is [string, string] => Boolean(e[1])),
  );
  return qs.size ? `/dashboard/inventory?${qs}` : "/dashboard/inventory";
}

// A GET form, so search works before hydration and the URL is shareable.
export function Filters({ filter }: { filter: Filter }) {
  return (
    <div className="flex flex-col gap-3">
      <form role="search" className="relative">
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
        {filter.kind && <input type="hidden" name="kind" value={filter.kind} />}
        {filter.language && (
          <input type="hidden" name="language" value={filter.language} />
        )}
      </form>
      <div className="-mx-4 flex gap-8 overflow-x-auto px-4 py-0.5 md:mx-0 md:flex-wrap md:px-0">
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
