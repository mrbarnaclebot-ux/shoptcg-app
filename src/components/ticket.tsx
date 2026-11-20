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

/** What a route shows while it streams: a ticket being written, not a grey pulse. */
export function TicketLoading({ children }: { children: ReactNode }) {
  return (
    <Ticket as="div" className="w-full">
      <p
        role="status"
        className="font-display text-[2rem] leading-none font-extrabold text-muted-foreground"
      >
        {children}
      </p>
    </Ticket>
  );
}

/** One labelled value on a ticket stub: table, code, hold timer. `hold`: it's running out. */
export function StubValue(props: {
  k: string;
  v: ReactNode;
  hold?: boolean;
  testId?: string;
}) {
  return (
    <div>
      <div className="text-sm leading-tight text-muted-foreground">
        {props.k}
        {/* In words too, not by colour alone (WCAG 1.4.1). */}
        {props.hold && (
          <span className="font-semibold text-warning"> · Ending</span>
        )}
      </div>
      <div
        data-testid={props.testId}
        className={`font-display num text-[1.875rem] leading-none font-extrabold ${props.hold ? "text-warning" : ""}`}
      >
        {props.v}
      </div>
    </div>
  );
}
