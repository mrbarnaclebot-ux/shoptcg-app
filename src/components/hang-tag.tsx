import { cn } from "cn";
import type { ReactNode } from "react";

/**
 * Price on a string tag. It inverts the material it hangs on (ink on paper,
 * paper in the hall), so it always reads as the thing tied to the item.
 */
export function HangTag(props: {
  price: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("hangtag", props.className)}>
      <span className="font-display num text-[1.75rem] leading-[0.9] font-black">
        {props.price}
      </span>
      {props.sub && (
        <span className="hangtag-sub num text-xs leading-tight">
          {props.sub}
        </span>
      )}
    </span>
  );
}
