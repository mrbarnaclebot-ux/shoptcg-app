import { cn } from "cn";
import type { ReactNode } from "react";

/**
 * Hall-sign section marker: a big poster numeral and a sentence-case title.
 * Replaces tracked uppercase micro-labels.
 */
export function SectionMark(props: {
  n: number;
  id?: string;
  level?: "h2" | "h3" | "legend";
  children: ReactNode;
  className?: string;
}) {
  const Tag = props.level ?? "h2";
  return (
    <Tag
      id={props.id}
      className={cn(
        "flex w-full items-baseline gap-3 text-lg font-semibold",
        props.className,
      )}
    >
      <span
        aria-hidden
        className="font-display num text-[2.5rem] leading-[0.8] font-extrabold text-brand-text"
      >
        {String(props.n).padStart(2, "0")}
      </span>
      {props.children}
    </Tag>
  );
}
