"use client";

import { TriangleAlert } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { CardThumb } from "@/components/card-thumb";
import { Stepper } from "@/components/stepper";
import {
  certNo,
  daysBetween,
  gradeLabel,
  LANGUAGE_LABEL,
  shortDate,
  usd,
} from "@/lib/format";
import type { StockRow as Row } from "@/lib/listings";
import { toast } from "@/lib/toast";
import { stepQtyAction, updateListingAction } from "./actions";
import { EditPanel } from "./edit-panel";

// Synced nightly, so two days without a new point means the sync is missing it.
const STALE_DAYS = 2;

/** One inventory item as a slab: label strip on top, readout and controls below. */
export function StockRow(props: {
  row: Row;
  price: number | null;
  today: string;
}) {
  const { row } = props;
  const [editing, setEditing] = useState(false);
  return (
    <li className="flex flex-col rounded-sm bg-surface ring-1 ring-border">
      <SlabLabel row={row} />
      <div className="flex flex-col gap-3 p-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-8">
        <div className="flex items-start gap-3 lg:flex-1">
          <CardThumb
            src={row.imageUrl}
            kind={row.kind}
            language={row.language}
          />
          <p
            lang={row.language === "en" ? undefined : row.language}
            className="line-clamp-2 min-w-0 flex-1 font-semibold wdth-108"
          >
            {row.name}
          </p>
          <PriceColumn {...props} />
        </div>
        <div className="flex items-center justify-between gap-3 pl-[52px] lg:gap-6 lg:pl-0">
          <Qty row={row} />
          <button
            type="button"
            aria-expanded={editing}
            onClick={() => setEditing(!editing)}
            className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand-text"
          >
            {editing ? "Close" : "Edit"}
          </button>
        </div>
        {editing && <EditPanel row={row} onDone={() => setEditing(false)} />}
      </div>
    </li>
  );
}

// The grading-label strip: set and number condensed, grade, cert number.
function SlabLabel({ row }: { row: Row }) {
  const set = [row.setName, row.number].filter(Boolean).join(" ");
  return (
    <div className="flex items-center gap-x-3 gap-y-1 border-b border-border px-3 py-1.5 text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
      <span className="min-w-0 truncate wdth-80">{set || "Custom item"}</span>
      <span className="rounded-[3px] bg-seal-50 px-1.5 text-galaxy-950">
        {gradeLabel(row) || "Raw"}
      </span>
      {row.language !== "en" && <span>{LANGUAGE_LABEL[row.language]}</span>}
      {!row.active && <span className="text-warning">Hidden</span>}
      <span className="num ml-auto shrink-0 font-semibold text-subtle">
        <span className="sr-only">Cert </span>
        {certNo(row.id)}
      </span>
    </div>
  );
}

function PriceColumn({ row, price, today }: Parameters<typeof StockRow>[0]) {
  const stale = row.asOf ? daysBetween(row.asOf, today) : 0;
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
      <span className="num min-w-[5ch] text-lg">
        {price === null ? "No price" : usd(price)}
      </span>
      {row.overridePrice !== null && (
        <span className="rounded-sm bg-surface-2 px-1.5 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          Fixed
        </span>
      )}
      {row.market !== null && row.asOf && (
        <span className="text-sm text-subtle">
          Mkt <span className="num font-medium">{usd(row.market)}</span>
          {" as of "}
          {shortDate(row.asOf)}
        </span>
      )}
      {stale > STALE_DAYS && (
        <span className="inline-flex items-center gap-1 rounded-sm bg-warning-bg px-1.5 text-xs font-semibold text-warning">
          <TriangleAlert aria-hidden className="size-3" />
          Price {stale} days old
        </span>
      )}
    </div>
  );
}

function Qty({ row }: { row: Row }) {
  const [shown, setShown] = useOptimistic(row.qty);
  const [, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const hide = () =>
    start(async () => {
      const res = await updateListingAction({ id: row.id, active: false });
      if (res.error) toast.notSaved(res.error);
      else toast.itemHidden(row.id, row.name);
    });
  const step = (delta: 1 | -1) =>
    start(async () => {
      setFailed(false);
      const next = Math.max(0, shown + delta);
      setShown(next);
      try {
        await stepQtyAction(row.id, delta);
        if (next === 0) toast.qtyZero(row.name, hide);
      } catch {
        // The optimistic value reverts on its own; say why it moved back.
        setFailed(true);
        toast.qtyFailed(shown);
      }
    });
  return (
    <div className="flex items-center gap-2">
      <Stepper value={shown} label="Quantity" onStep={step} />
      {failed ? (
        <span className="text-sm font-semibold text-danger">Not saved.</span>
      ) : (
        shown === 0 && <SoldOut active={row.active} onHide={hide} />
      )}
    </div>
  );
}

// The toast's "Hide item" lives here too: toast buttons are shortcuts, never the only path.
function SoldOut({ active, onHide }: { active: boolean; onHide: () => void }) {
  return (
    <span className="flex items-center gap-1 text-sm font-semibold text-subtle">
      Sold out
      {active && (
        <button
          type="button"
          onClick={onHide}
          className="min-h-11 px-2 text-brand-text"
        >
          Hide
        </button>
      )}
    </span>
  );
}
