import { Search } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { Input } from "@/components/ui/input";

// Unknown values fall back to "no filter" instead of erroring on a hand-edited URL.
export const filterSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  kind: z
    .enum(["raw", "graded", "sealed", "hidden"])
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
  ["hidden", "Hidden"],
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

// 36px visual chip inside a 44px hit area (UI-SPEC 7).
function Chip(props: { href: string; on: boolean; children: string }) {
  return (
    <Link
      href={props.href}
      aria-current={props.on ? "true" : undefined}
      scroll={false}
      className="group inline-flex h-11 shrink-0 items-center px-1"
    >
      <span className="inline-flex h-9 items-center rounded-sm bg-surface-2 px-3 text-sm font-semibold text-muted-foreground group-aria-[current=true]:bg-brand-bg group-aria-[current=true]:text-sunrise-200 group-aria-[current=true]:ring-1 group-aria-[current=true]:ring-brand">
        {props.children}
      </span>
    </Link>
  );
}

// A GET form, so search works before hydration and the URL is shareable.
export function Filters({ filter }: { filter: Filter }) {
  return (
    <div className="flex flex-col gap-2">
      <form role="search" className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-subtle"
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
      <div className="-mx-4 flex overflow-x-auto px-3 md:mx-0 md:flex-wrap md:px-0">
        {KINDS.map(([kind, label]) => (
          <Chip
            key={label}
            href={href(filter, { kind })}
            on={filter.kind === kind}
          >
            {label}
          </Chip>
        ))}
        <span aria-hidden className="mx-1 my-3 w-px shrink-0 bg-border" />
        {LANGS.map(([language, label]) => (
          <Chip
            key={label}
            href={href(filter, { language })}
            on={filter.language === language}
          >
            {label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
