import { cn } from "cn";
import { ChevronDown, Search, X } from "lucide-react";
import Link from "next/link";
import type { PublicFilter, Sort } from "@/lib/storefront";
import { filterHref, SORT_LABEL } from "./params";

const TYPES = [
  [undefined, "All"],
  ["raw", "Raw"],
  ["graded", "Graded"],
  ["sealed", "Sealed"],
] as const;

const LANGS = [
  ["en", "EN"],
  ["ja", "JP"],
  ["zh", "CN"],
] as const;

// Links and a GET form: filters work with no JS and every view is a URL.
// aria-current (not aria-pressed, which links may not carry) marks the chosen chips.
function Chip(props: { href: string; on: boolean; children: string }) {
  return (
    <Link
      href={props.href}
      scroll={false}
      aria-current={props.on ? "true" : undefined}
      className={cn(
        "grid h-11 shrink-0 place-items-center px-3.5 text-[0.90625rem]",
        props.on
          ? "bg-text font-semibold text-bg"
          : "font-medium text-muted-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]",
      )}
    >
      {props.children}
    </Link>
  );
}

function toggle<T>(list: T[] = [], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function Controls({ slug, f }: { slug: string; f: PublicFilter }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-surface px-4 pt-3 pb-2.5 md:-mx-6 md:px-6 lg:mx-0 lg:flex lg:items-center lg:gap-4 lg:px-4">
      <form
        action={`/${slug}`}
        role="search"
        className="flex h-12 items-center gap-2.5 bg-bg px-3.5 shadow-[inset_0_0_0_1px_var(--border-strong)] focus-within:shadow-[inset_0_0_0_2px_var(--focus)] lg:w-80 lg:shrink-0"
      >
        <Search
          aria-hidden
          className="size-[18px] shrink-0 text-muted-foreground"
        />
        {f.type && <input type="hidden" name="type" value={f.type} />}
        {f.langs?.map((l) => (
          <input key={l} type="hidden" name="lang" value={l} />
        ))}
        {f.sort && <input type="hidden" name="sort" value={f.sort} />}
        <input
          type="search"
          name="q"
          defaultValue={f.q}
          maxLength={60}
          enterKeyHint="search"
          placeholder="Search name or number"
          aria-label="Search name or number"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        />
        {f.q && (
          <Link
            href={filterHref(slug, { ...f, q: undefined })}
            aria-label="Clear search"
            className="grid size-11 place-items-center text-muted-foreground"
          >
            <X aria-hidden className="size-[18px]" />
          </Link>
        )}
      </form>
      <nav
        aria-label="Filters"
        className="mt-2.5 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] lg:mt-0"
      >
        {TYPES.map(([type, label]) => (
          <Chip
            key={label}
            href={filterHref(slug, { ...f, type })}
            on={f.type === type}
          >
            {label}
          </Chip>
        ))}
        <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border-strong" />
        {LANGS.map(([lang, label]) => (
          <Chip
            key={lang}
            href={filterHref(slug, { ...f, langs: toggle(f.langs, lang) })}
            on={Boolean(f.langs?.includes(lang))}
          >
            {label}
          </Chip>
        ))}
      </nav>
    </div>
  );
}

/** "Sort: Price high to low" as a native disclosure of links: no JS needed. */
export function SortMenu({ slug, f }: { slug: string; f: PublicFilter }) {
  const current = f.sort ?? "price-desc";
  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
        Sort:{" "}
        <span className="font-semibold text-text">{SORT_LABEL[current]}</span>
        <ChevronDown
          aria-hidden
          className="size-4 transition-transform group-open:rotate-180"
        />
      </summary>
      <ul className="paper absolute right-0 z-10 mt-1 w-52 py-1 shadow-[0_12px_24px_oklch(0_0_0/0.5)]">
        {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
          <li key={s}>
            <Link
              href={filterHref(slug, { ...f, sort: s })}
              scroll={false}
              aria-current={s === current ? "true" : undefined}
              className="flex min-h-11 items-center px-4 aria-[current=true]:font-semibold hover:bg-surface"
            >
              {SORT_LABEL[s]}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
