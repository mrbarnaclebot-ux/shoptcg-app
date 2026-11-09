"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { CardThumb } from "@/components/card-thumb";
import { HangTag } from "@/components/hang-tag";
import { Stamp } from "@/components/stamp";
import { Stepper } from "@/components/stepper";
import { HatchTag, TapeHatch } from "@/components/tape-hatch";
import {
  daysBetween,
  gradeLabel,
  LANGUAGE_LABEL,
  shortDate,
  usd,
} from "@/lib/format";
import type { StockRow as Row } from "@/lib/listings";
import { toast } from "@/lib/toast";
import { underMarket } from "@/lib/vendor-price";
import { stepQtyAction, updateListingAction } from "./actions";
import { EditPanel } from "./edit-panel";

// Synced nightly, so two days without a new point means the sync is missing it.
const STALE_DAYS = 2;

/** One inventory item: the thumb, a hang-tag price, a stamp when it's a deal. */
export function StockRow(props: {
  row: Row;
  price: number | null;
  today: string;
}) {
  const { row, price } = props;
  const [editing, setEditing] = useState(false);
  const off = !row.active ? "Hidden" : row.qty === 0 ? "Sold out" : null;
  const thumb = (
    <CardThumb
      src={row.imageUrl}
      kind={row.kind}
      language={row.language}
      className="w-11"
    />
  );
  return (
    <li className="border-b border-border last:border-b-0">
      <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-4 py-3 lg:grid-cols-[44px_minmax(0,1fr)_3rem_11rem_11rem_4rem] lg:items-center lg:gap-x-5">
        {off ? <TapeHatch label={off}>{thumb}</TapeHatch> : thumb}
        <Name row={row} price={price} />
        <span className="font-display hidden text-[0.95rem] font-extrabold tracking-[0.06em] text-muted-foreground lg:block">
          {LANGUAGE_LABEL[row.language]}
        </span>
        <div className="col-start-2 row-start-2 flex items-center gap-3 lg:col-start-4 lg:row-start-1">
          <Qty row={row} />
        </div>
        <PriceTag {...props} />
        <button
          type="button"
          aria-expanded={editing}
          onClick={() => setEditing(!editing)}
          className="col-start-3 row-start-2 inline-flex min-h-11 items-center justify-self-end px-2 font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px] lg:col-start-6 lg:row-start-1"
        >
          {editing ? "Close" : "Edit"}
        </button>
      </div>
      {editing && <EditPanel row={row} onDone={() => setEditing(false)} />}
    </li>
  );
}

function Name({ row, price }: { row: Row; price: number | null }) {
  const set = [row.setName, row.number].filter(Boolean).join(" ");
  const deal = underMarket(price, row.market);
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      {deal && <Stamp>{deal}% under market</Stamp>}
      <p
        lang={row.language === "en" ? undefined : row.language}
        className="line-clamp-2 font-semibold"
      >
        {row.name}
      </p>
      <p className="text-sm text-muted-foreground">
        {[set || "Custom item", gradeLabel(row) || "Raw"].join(". ")}
        <span className="lg:hidden">. {LANGUAGE_LABEL[row.language]}</span>
      </p>
      {!row.active && <HatchTag>Hidden from buyers</HatchTag>}
    </div>
  );
}

function PriceTag({ row, price, today }: Parameters<typeof StockRow>[0]) {
  const stale = row.asOf ? daysBetween(row.asOf, today) : 0;
  const mkt =
    row.market !== null && row.asOf
      ? `Mkt ${usd(row.market)}, ${shortDate(row.asOf)}`
      : null;
  return (
    <div className="col-start-3 row-start-1 flex flex-col items-end gap-1 lg:col-start-5">
      {price === null ? (
        // A task, not a price: outline only, so it never reads as one.
        <span className="inline-flex min-h-9 items-center px-3 text-[0.9375rem] font-semibold text-brand-text shadow-[inset_0_0_0_1.5px_var(--brand)]">
          Set a price
        </span>
      ) : (
        <HangTag price={usd(price)} />
      )}
      {row.overridePrice !== null && (
        <span className="text-xs font-semibold text-muted-foreground">
          Fixed price
        </span>
      )}
      {mkt && (
        <span className="num text-right text-xs text-muted-foreground">
          {mkt}
        </span>
      )}
      {stale > STALE_DAYS && (
        <span className="px-1.5 py-1 text-xs leading-none font-semibold text-warning shadow-[inset_0_0_0_1px_currentColor]">
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
  // "Not saved." goes once the network is back; the toast says so too.
  useEffect(() => {
    if (!failed) return;
    const clear = () => setFailed(false);
    addEventListener("online", clear);
    return () => removeEventListener("online", clear);
  }, [failed]);
  const hide = () =>
    start(async () => {
      const res = await updateListingAction({ id: row.id, active: false });
      if (res.error) toast.notSaved(res.error);
      else toast.itemHidden(row.name);
    });
  const step = (delta: 1 | -1) =>
    start(async () => {
      setFailed(false);
      const next = Math.max(0, shown + delta);
      setShown(next);
      try {
        // null: the row is gone or not this store's; nothing to warn about.
        const qty = await stepQtyAction(row.id, delta);
        if (qty === 0) toast.qtyZero(row.name, hide);
      } catch {
        // The optimistic value reverts on its own; say why it moved back.
        setFailed(true);
        toast.qtyFailed(shown, () => step(delta));
      }
    });
  return (
    <>
      <Stepper value={shown} label={`Quantity, ${row.name}`} onStep={step} />
      {failed ? (
        <span className="text-sm font-semibold text-danger">Not saved.</span>
      ) : (
        shown === 0 && <SoldOut active={row.active} onHide={hide} />
      )}
    </>
  );
}

// The toast's "Hide item" lives here too: toast buttons are shortcuts, never the only path.
function SoldOut({ active, onHide }: { active: boolean; onHide: () => void }) {
  if (!active) return null;
  return (
    <button
      type="button"
      onClick={onHide}
      className="min-h-11 px-1 text-sm font-semibold underline decoration-brand decoration-[1.5px] underline-offset-4"
    >
      Hide
    </button>
  );
}
