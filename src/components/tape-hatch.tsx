import { cn } from "cn";
import type { ReactNode } from "react";

/**
 * Tape across the case: a hatch over an item's art that says why it can't be
 * picked ("On hold", "Hidden", "Sold out"). The label is real text.
 */
export function TapeHatch(props: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-block shrink-0", props.className)}>
      {props.children}
      <span className="hatch font-display absolute inset-0 grid place-items-center text-center text-[0.6875rem] leading-none font-extrabold tracking-[0.04em]">
        {props.label}
      </span>
    </span>
  );
}

/** The same tape as an inline tag, for rows and lists. */
export function HatchTag(props: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "hatch-tag inline-flex items-center px-1.5 py-1 text-xs leading-none font-semibold",
        props.className,
      )}
    >
      {props.children}
    </span>
  );
}
