import type { ReactNode } from "react";

/** Slab-label section header: hairline rule, uppercase label, tabular meta, ruler ticks. */
export function SlabHead(props: {
  id?: string;
  meta?: ReactNode;
  level?: "h1" | "h2";
  children: ReactNode;
}) {
  const Tag = props.level ?? "h2";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 border-t border-border-strong pt-2">
        <Tag
          id={props.id}
          className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase"
        >
          {props.children}
        </Tag>
        {props.meta && (
          <span className="num text-xs text-subtle">{props.meta}</span>
        )}
      </div>
      <div aria-hidden className="ruler" />
    </div>
  );
}
