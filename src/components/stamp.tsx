import { cn } from "cn";
import type { ReactNode } from "react";

/** Rubber stamp a vendor slapped on: outlined, two degrees off true. "12% under market". */
export function Stamp(props: { children: ReactNode; className?: string }) {
  return <span className={cn("stamp", props.className)}>{props.children}</span>;
}
