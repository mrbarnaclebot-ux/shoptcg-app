import { ChevronDown } from "lucide-react";
import Link from "next/link";

/** "Sort: Price high to low" as a native disclosure of links: no JS needed. */
export function SortMenu(props: {
  options: readonly { label: string; href: string; on: boolean }[];
}) {
  const current = props.options.find((o) => o.on);
  return (
    // Keyed on the choice: a client navigation keeps the DOM, so it would stay open.
    <details key={current?.label} className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
        Sort: <span className="font-semibold text-text">{current?.label}</span>
        <ChevronDown
          aria-hidden
          className="size-4 transition-transform group-open:rotate-180"
        />
      </summary>
      <ul className="paper absolute right-0 z-10 mt-1 w-52 py-1 shadow-[0_12px_24px_oklch(0_0_0/0.5)]">
        {props.options.map((o) => (
          <li key={o.label}>
            <Link
              href={o.href}
              scroll={false}
              aria-current={o.on ? "true" : undefined}
              className="flex min-h-11 items-center px-4 aria-[current=true]:font-semibold hover:bg-surface"
            >
              {o.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
