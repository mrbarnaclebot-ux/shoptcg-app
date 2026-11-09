import { cn } from "cn";
import type { ReactNode } from "react";

/**
 * Paper ticket: the material for anything a vendor or buyer holds. A
 * perforated stub tears off the right with its own content (code, hold
 * timer) or, without it, a thin stub carrying only the stub number.
 */
export function Ticket(props: {
  children: ReactNode;
  stub?: ReactNode;
  no?: string;
  as?: "section" | "div" | "li" | "article";
  className?: string;
  bodyClassName?: string;
}) {
  const Tag = props.as ?? "section";
  return (
    <Tag
      data-stub={props.stub ? undefined : "thin"}
      className={cn("paper ticket", props.className)}
    >
      <div className={cn("min-w-0 p-5", props.bodyClassName)}>
        {props.children}
      </div>
      <div className="ticket-stub">
        {props.stub}
        {props.no && (
          <span className="ticket-no num">
            <span className="sr-only">Ticket </span>No. {props.no}
          </span>
        )}
      </div>
    </Tag>
  );
}

/** One labelled value on a ticket stub: table, code, hold timer. */
export function StubValue(props: {
  k: string;
  v: ReactNode;
  hold?: boolean;
  testId?: string;
}) {
  return (
    <div>
      <div className="text-xs leading-tight text-muted-foreground">
        {props.k}
      </div>
      <div
        data-testid={props.testId}
        className={`font-display num text-[1.875rem] leading-none font-extrabold ${props.hold ? "text-brand-text" : ""}`}
      >
        {props.v}
      </div>
    </div>
  );
}
