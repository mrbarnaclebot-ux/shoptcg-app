import { cn } from "cn";

/**
 * The lamp-orange wayfinding block. It matches the cardboard number on the
 * case, so a buyer can find their way back to the table.
 */
export function TableNumber(props: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-[4.5rem] flex-col items-center bg-brand px-2.5 pt-1.5 pb-2 text-on-brand",
        props.className,
      )}
    >
      <span className="text-xs leading-none font-semibold">{props.label}</span>
      <span className="font-display num text-[2.375rem] leading-[0.9] font-black">
        {props.value}
      </span>
    </div>
  );
}
