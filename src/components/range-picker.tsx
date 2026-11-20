import Link from "next/link";
import { lineButton } from "@/components/ticket-button";
import {
  lastMonthOf,
  monthOf,
  weekendLabel,
  weekendOf,
  type Range,
} from "@/lib/reports";

const dateInput =
  "h-12 w-full min-w-0 border border-border-strong bg-transparent px-2 text-base";

function Preset(props: { href: string; on: boolean; children: string }) {
  return (
    <Link
      href={props.href}
      aria-current={props.on ? "page" : undefined}
      className={
        props.on
          ? "grid h-11 place-items-center bg-text px-3.5 font-semibold text-bg"
          : "grid h-11 place-items-center px-3.5 font-medium text-muted-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]"
      }
    >
      {props.children}
    </Link>
  );
}

/** "Today", the nearest weekend and the months, as links: every range is a URL. */
export function RangePresets(props: {
  base: string;
  label: string;
  range: Range;
  today: string;
}) {
  const { base, range, today } = props;
  const to = (r: { from: string; to: string }) =>
    `${base}?from=${r.from}&to=${r.to}`;
  return (
    <nav aria-label={props.label} className="flex flex-wrap gap-2">
      <Preset href={base} on={range.preset === "today"}>
        Today
      </Preset>
      <Preset href={to(weekendOf(today))} on={range.preset === "weekend"}>
        {weekendLabel(today)}
      </Preset>
      <Preset href={to(monthOf(today))} on={range.preset === "month"}>
        This month
      </Preset>
      <Preset href={to(lastMonthOf(today))} on={range.preset === "last-month"}>
        Last month
      </Preset>
    </nav>
  );
}

/** Two date fields in a GET form, so a custom range needs no script. */
export function RangeForm({ base, range }: { base: string; range: Range }) {
  return (
    <form
      action={base}
      className="mt-5 grid grid-cols-2 items-end gap-3 border-y border-dashed border-border-strong py-4 sm:grid-cols-[1fr_1fr_auto]"
    >
      <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold">
        From
        <input
          type="date"
          name="from"
          defaultValue={range.from}
          required
          className={dateInput}
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold">
        To
        <input
          type="date"
          name="to"
          defaultValue={range.to}
          required
          className={dateInput}
        />
      </label>
      <button
        type="submit"
        className={`${lineButton} col-span-2 sm:col-span-1`}
      >
        Show these days
      </button>
    </form>
  );
}
