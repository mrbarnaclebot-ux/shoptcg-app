import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
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
  /** A picture of the section beside its title; grey, since orange means tap. */
  icon?: LucideIcon;
}) {
  const Tag = props.level ?? "h2";
  const Icon = props.icon;
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
        className="font-display num text-3xl leading-[0.8] font-extrabold text-brand-text"
      >
        {String(props.n).padStart(2, "0")}
      </span>
      {Icon && (
        <Icon
          aria-hidden
          className="size-5 shrink-0 self-center stroke-[1.75] text-muted-foreground"
        />
      )}
      {props.children}
    </Tag>
  );
}
