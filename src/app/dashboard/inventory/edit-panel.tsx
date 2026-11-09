"use client";

import { useState, useTransition } from "react";
import { Ticket } from "@/components/ticket";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONDITIONS } from "@/lib/listing-input";
import type { StockRow } from "@/lib/listings";
import { toast } from "@/lib/toast";
import { updateListingAction } from "./actions";

export function EditPanel({
  row,
  onDone,
}: {
  row: StockRow;
  onDone: () => void;
}) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const save = (patch: Record<string, unknown>, done: () => void) =>
    start(async () => {
      const res = await updateListingAction({ id: row.id, ...patch });
      setError(res.error);
      if (res.error) return void toast.notSaved(res.error);
      done();
      onDone();
    });
  return (
    // A paper slip under the row: you are holding this item while you edit it.
    <Ticket
      as="div"
      className="mx-4 mb-4 [--stub:2rem] lg:ml-[76px] lg:max-w-lg"
    >
      <form
        data-panel
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const fixed = String(form.get("overridePrice") ?? "").trim();
          const change = fixed
            ? `Fixed price ${fixed.replace("$", "")}.`
            : "Follows the market.";
          save(
            {
              overridePrice: fixed,
              ...(row.kind === "raw" && { condition: form.get("condition") }),
            },
            () => toast.itemUpdated(row.name, change),
          );
        }}
      >
        <Fields row={row} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <TicketButton type="submit" disabled={pending} aria-busy={pending}>
            Save
          </TicketButton>
          <TicketButton
            variant="secondary"
            disabled={pending}
            onClick={() =>
              save({ active: !row.active }, () =>
                row.active
                  ? toast.itemHidden(row.name)
                  : toast.itemUpdated(row.name, "Back on your public table."),
              )
            }
          >
            {row.active ? "Hide from store" : "Show in store"}
          </TicketButton>
        </div>
      </form>
    </Ticket>
  );
}

function Fields({ row }: { row: StockRow }) {
  const priceId = `price-${row.id}`;
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={priceId}>Fixed price (USD)</Label>
        <Input
          id={priceId}
          name="overridePrice"
          inputMode="decimal"
          defaultValue={row.overridePrice?.toFixed(2) ?? ""}
          placeholder="Use market price"
          aria-describedby={`${priceId}-hint`}
        />
        <p id={`${priceId}-hint`} className="text-sm text-muted-foreground">
          Leave blank to follow the market with your store rule.
        </p>
      </div>
      {row.kind === "raw" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`cond-${row.id}`}>Condition</Label>
          <select
            id={`cond-${row.id}`}
            name="condition"
            defaultValue={row.condition ?? "NM"}
            className="h-12 bg-bg px-3 text-base shadow-[inset_0_0_0_1.5px_var(--border-strong)] focus-visible:shadow-[inset_0_0_0_2.5px_var(--focus)] focus-visible:outline-none"
          >
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
