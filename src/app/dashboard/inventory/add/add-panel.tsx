"use client";

import { Check, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CardThumb } from "@/components/card-thumb";
import { ShowMoment } from "@/components/show-moment";
import { Segmented } from "@/components/segmented";
import { Ticket } from "@/components/ticket";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogItem } from "@/db/schema";
import { CONDITIONS, GRADERS, GRADES, type Condition } from "@/lib/condition";
import type { Grader } from "@/lib/pricing/provider";
import { toast } from "@/lib/toast";
import { addCatalogAction } from "../actions";
import { CostField } from "../edit-panel";

export function AddPanel({
  item,
  graded = false,
  onClose,
}: {
  item: CatalogItem;
  /** Listing a raw card as a slab: the vendor picks grader and grade here. */
  graded?: boolean;
  onClose: () => void;
}) {
  const [condition, setCondition] = useState<Condition>("NM");
  const [grader, setGrader] = useState<Grader>("PSA");
  const [error, setError] = useState<string>();
  const [added, setAdded] = useState<{ first: boolean; merged?: Merged }>();
  const [pending, start] = useTransition();
  const submit = (form: FormData) =>
    start(async () => {
      const fixed = String(form.get("overridePrice") ?? "").trim();
      const res = await addCatalogAction({
        catalogItemId: item.id,
        condition: item.kind === "raw" && !graded ? condition : null,
        grader: graded ? grader : null,
        grade: graded ? form.get("grade") : null,
        qty: form.get("qty"),
        overridePrice: fixed,
        cost: form.get("cost"),
      });
      setError(res.error);
      if (res.error) return void toast.notSaved(res.error);
      // The panel turns into the confirmation; no toast on top of it.
      setAdded({ first: Boolean(res.first), merged: res.merged ?? undefined });
    });
  if (added)
    return (
      <Added
        name={item.name}
        first={added.first}
        merged={added.merged}
        onAgain={onClose}
      />
    );
  return (
    <Ticket as="div" className="[--stub:2rem]">
      <form action={submit} data-panel className="flex flex-col gap-5">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-muted-foreground hover:text-text"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Back to results
        </button>
        <ItemHeader item={item} />
        {graded ? (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <Segmented
              label="Grader"
              value={grader}
              options={GRADERS.map((g) => [g, g] as const)}
              onChange={setGrader}
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="grade">Grade</Label>
              <select
                id="grade"
                name="grade"
                defaultValue="10"
                className="h-12 min-w-24 bg-bg px-3 text-base shadow-[inset_0_0_0_1.5px_var(--border-strong)] focus-visible:shadow-[inset_0_0_0_2.5px_var(--focus)] focus-visible:outline-none"
              >
                {GRADES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          item.kind === "raw" && (
            <Segmented
              label="Condition"
              value={condition}
              options={CONDITIONS.map((c) => [c, c] as const)}
              onChange={setCondition}
            />
          )
        )}
        <StockFields />
        {error && <p className="text-sm text-danger">{error}</p>}
        <TicketButton type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Adding" : "Add to stock"}
        </TicketButton>
      </form>
    </Ticket>
  );
}

/** Qty, optional fixed price and cost; shared with the custom item form. */
export function StockFields({
  errors = {},
}: {
  errors?: Record<string, string>;
}) {
  return (
    <>
      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="qty">Qty</Label>
          <Input
            id="qty"
            name="qty"
            type="number"
            min={0}
            max={9999}
            defaultValue={1}
            required
            className="num"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="overridePrice">Fixed price (optional)</Label>
          <Input
            id="overridePrice"
            name="overridePrice"
            inputMode="decimal"
            placeholder="Use market price"
            aria-invalid={errors.overridePrice ? true : undefined}
            aria-describedby="price-error"
          />
        </div>
        {(errors.qty || errors.overridePrice) && (
          <p id="price-error" className="col-span-2 text-sm text-danger">
            {errors.qty ?? errors.overridePrice}
          </p>
        )}
      </div>
      <CostField id="cost" error={errors.cost} />
    </>
  );
}

type Merged = { from: number; to: number };

/** Inline confirmation; the store's first item gets the show-floor moment. */
export function Added(props: {
  name: string;
  first: boolean;
  /** Went onto a listing the store already had: its quantity before and after. */
  merged?: Merged;
  onAgain?: () => void;
}) {
  const actions = (
    <div className="flex flex-wrap gap-3">
      {props.onAgain && (
        <TicketButton onClick={props.onAgain}>Add another</TicketButton>
      )}
      <Link
        href="/dashboard/inventory"
        className="inline-flex min-h-12 items-center px-2 font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
      >
        View inventory
      </Link>
    </div>
  );
  if (props.first)
    return (
      <ShowMoment stamp="First card" headline="On the table" no="0001">
        <p className="text-muted-foreground">
          Added {props.name} to your stock. Buyers can see it now.
        </p>
        {actions}
      </ShowMoment>
    );
  return (
    <Ticket
      as="div"
      className="[--stub:2rem]"
      bodyClassName="flex flex-col gap-4"
    >
      <p role="status" className="flex items-center gap-2 font-semibold">
        <Check aria-hidden className="size-5 shrink-0 text-success" />
        {props.merged
          ? `Added to your ${props.name}: ${props.merged.from} → ${props.merged.to}.`
          : `Added ${props.name} to your stock.`}
      </p>
      {actions}
    </Ticket>
  );
}

function ItemHeader({ item }: { item: CatalogItem }) {
  return (
    <div className="flex items-center gap-4">
      <CardThumb
        src={item.imageUrl}
        kind={item.kind}
        language={item.language}
        className="w-20"
      />
      <div className="min-w-0">
        <h2 className="font-display text-[1.875rem] leading-none font-extrabold">
          {item.name}
        </h2>
        <p className="text-sm text-muted-foreground">
          {[item.setName, item.number].filter(Boolean).join(" ")}
        </p>
        {item.grader && (
          <p className="text-sm font-semibold">
            {item.grader} {item.grade}
          </p>
        )}
      </div>
    </div>
  );
}
