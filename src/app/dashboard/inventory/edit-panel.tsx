"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONDITIONS } from "@/lib/listing-input";
import type { StockRow } from "@/lib/listings";
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
  const save = (patch: Record<string, unknown>) =>
    start(async () => {
      const res = await updateListingAction({ id: row.id, ...patch });
      setError(res.error);
      if (!res.error) onDone();
    });
  const priceId = `price-${row.id}`;
  return (
    <form
      className="ml-[52px] flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-1"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        save({
          overridePrice: form.get("overridePrice"),
          ...(row.kind === "raw" && { condition: form.get("condition") }),
        });
      }}
    >
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
        <p id={`${priceId}-hint`} className="text-sm text-subtle">
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
            className="h-12 rounded-md border border-input bg-surface-2 px-3 text-base"
          >
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          disabled={pending}
          onClick={() => save({ active: !row.active })}
        >
          {row.active ? "Hide from store" : "Show in store"}
        </Button>
      </div>
    </form>
  );
}
