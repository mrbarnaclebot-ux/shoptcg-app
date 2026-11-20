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
import type { SearchItem } from "@/lib/catalog";
import { CONDITIONS, GRADERS, GRADES, type Condition } from "@/lib/condition";
import { usd } from "@/lib/format";
import type { Grader } from "@/lib/pricing/provider";
import { toast } from "@/lib/toast";
import { conditionPrice, type StorePricing } from "@/lib/vendor-price";
import { addCatalogAction } from "../actions";
import { CostField } from "../edit-panel";

export const OFFLINE =
  "Couldn't reach the server. Check your connection and try again.";

/**
 * The market a catalog pick sells from, in its condition, and the store's
 * price for it. A slab picked from a raw card has no market until it's
 * looked up after the add.
 */
export function MarketLine(props: {
  item: SearchItem;
  condition: Condition;
  graded: boolean;
  pricing: StorePricing;
  /** Their offer, on the buy screen; the add screen says what you sell at. */
  sell?: boolean;
}) {
  const { item, condition } = props;
  const raw = item.kind === "raw" && !props.graded;
  const p = conditionPrice(
    props.graded || item.market === null ? null : Number(item.market),
    raw ? props.pricing.cond[condition] : 100,
    props.pricing,
  );
  if (!p) return <p className="text-sm text-muted-foreground">No price yet</p>;
  const nm = usd(Number(item.market));
  return (
    <p className="num font-semibold">
      {props.sell === false
        ? `Market ${usd(p.market)}${raw ? ` (${condition})` : ""}`
        : `Market ${nm}${raw ? " (NM)" : ""} → you sell${raw && condition !== "NM" ? ` ${condition}` : ""} at ${usd(p.sell)}`}
    </p>
  );
}

export function AddPanel({
  item,
  graded = false,
  pricing,
  condition: initialCondition = "NM",
  onCondition,
  onClose,
}: {
  item: SearchItem;
  /** Listing a raw card as a slab: the vendor picks grader and grade here. */
  graded?: boolean;
  pricing: StorePricing;
  /** The last condition picked, remembered by the search. */
  condition?: Condition;
  onCondition?: (c: Condition) => void;
  onClose: () => void;
}) {
  const [condition, setCondition] = useState<Condition>(initialCondition);
  const [grader, setGrader] = useState<Grader>("PSA");
  const [grade, setGrade] = useState("10");
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
        grade: graded ? grade : null,
        qty: form.get("qty"),
        overridePrice: fixed,
        cost: form.get("cost"),
      }).catch(() => ({ error: OFFLINE, first: false, merged: null }));
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
      {/* By hand: a form action clears the fields even when the add fails. */}
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          submit(new FormData(ev.currentTarget));
        }}
        data-panel
        className="flex flex-col gap-5"
      >
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
          <SlabFields
            id="grade"
            grader={grader}
            onGrader={setGrader}
            grade={grade}
            onGrade={setGrade}
          />
        ) : (
          item.kind === "raw" && (
            <Segmented
              label="Condition"
              value={condition}
              options={CONDITIONS.map((c) => [c, c] as const)}
              onChange={(c) => {
                setCondition(c);
                onCondition?.(c);
              }}
            />
          )
        )}
        <div role="status">
          <MarketLine
            item={item}
            condition={condition}
            graded={graded}
            pricing={pricing}
          />
        </div>
        <StockFields />
        {error && <p className="text-sm text-danger">{error}</p>}
        <TicketButton type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Adding" : "Add to stock"}
        </TicketButton>
      </form>
    </Ticket>
  );
}

/** Grader and grade for a raw card listed or bought as a slab. */
export function SlabFields(props: {
  id: string;
  grader: Grader;
  onGrader: (g: Grader) => void;
  grade: string;
  onGrade: (g: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <Segmented
        label="Grader"
        name={`${props.id}-grader`}
        value={props.grader}
        options={GRADERS.map((g) => [g, g] as const)}
        onChange={props.onGrader}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor={props.id}>Grade</Label>
        <select
          id={props.id}
          value={props.grade}
          onChange={(e) => props.onGrade(e.target.value)}
          className="h-12 min-w-24 bg-bg px-3 text-base shadow-[inset_0_0_0_1.5px_var(--border-strong)] focus-visible:shadow-[inset_0_0_0_2.5px_var(--focus)] focus-visible:outline-none"
        >
          {GRADES.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </div>
    </div>
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
        <h2 className="font-display text-2xl font-extrabold">{item.name}</h2>
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
