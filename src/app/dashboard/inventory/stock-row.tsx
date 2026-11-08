"use client";

import { Minus, Plus, TriangleAlert } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { CardThumb } from "@/components/card-thumb";
import {
  daysBetween,
  gradeLabel,
  LANGUAGE_LABEL,
  shortDate,
  usd,
} from "@/lib/format";
import type { StockRow as Row } from "@/lib/listings";
import { stepQtyAction } from "./actions";
import { EditPanel } from "./edit-panel";

// Synced nightly, so two days without a new point means the sync is missing it.
const STALE_DAYS = 2;

export function StockRow(props: {
  row: Row;
  price: number | null;
  today: string;
}) {
  const { row } = props;
  const [editing, setEditing] = useState(false);
  const meta = [
    [row.setName, row.number].filter(Boolean).join(" "),
    gradeLabel(row),
  ].filter(Boolean);
  return (
    <li className="flex flex-col gap-3 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-8">
      <div className="flex items-start gap-3 lg:flex-1">
        <CardThumb src={row.imageUrl} kind={row.kind} />
        <div className="min-w-0 flex-1">
          <p
            lang={row.language === "en" ? undefined : row.language}
            className="line-clamp-2 font-semibold"
          >
            {row.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {meta.join(". ")}
            {row.language !== "en" && (
              <span className="ml-2 rounded-sm bg-surface-2 px-1.5 py-0.5 text-xs font-semibold">
                {LANGUAGE_LABEL[row.language]}
              </span>
            )}
          </p>
        </div>
        <PriceColumn {...props} />
      </div>
      <div className="flex items-center justify-between gap-3 pl-[52px] lg:gap-6 lg:pl-0">
        <QtyStepper id={row.id} qty={row.qty} />
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
    </li>
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

function QtyStepper({ id, qty }: { id: string; qty: number }) {
  const [shown, setShown] = useOptimistic(qty);
  const [, start] = useTransition();
  const step = (delta: 1 | -1) =>
    start(async () => {
      setShown(Math.max(0, shown + delta));
      await stepQtyAction(id, delta);
    });
  const btn =
    "grid size-11 place-items-center rounded-md bg-surface-2 ring-1 ring-border-strong disabled:opacity-40";
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Quantity">
      <button
        type="button"
        className={btn}
        aria-label="One fewer"
        disabled={shown === 0}
        onClick={() => step(-1)}
      >
        <Minus aria-hidden className="size-5" />
      </button>
      <output aria-live="polite" className="num w-12 text-center text-lg">
        {shown}
      </output>
      <button
        type="button"
        className={btn}
        aria-label="One more"
        onClick={() => step(1)}
      >
        <Plus aria-hidden className="size-5" />
      </button>
      {shown === 0 && (
        <span className="ml-2 text-sm font-semibold text-subtle">Sold out</span>
      )}
    </div>
  );
}
