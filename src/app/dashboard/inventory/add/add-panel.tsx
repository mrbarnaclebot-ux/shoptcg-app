"use client";

import { Check, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CardThumb } from "@/components/card-thumb";
import { RipMoment } from "@/components/rip-moment";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogItem } from "@/db/schema";
import { CONDITIONS, type Condition } from "@/lib/listing-input";
import { toast } from "@/lib/toast";
import { addCatalogAction } from "../actions";

export function AddPanel({
  item,
  onClose,
}: {
  item: CatalogItem;
  onClose: () => void;
}) {
  const [condition, setCondition] = useState<Condition>("NM");
  const [error, setError] = useState<string>();
  const [added, setAdded] = useState<{ first: boolean }>();
  const [pending, start] = useTransition();
  const submit = (form: FormData) =>
    start(async () => {
      const fixed = String(form.get("overridePrice") ?? "").trim();
      const res = await addCatalogAction({
        catalogItemId: item.id,
        condition: item.kind === "raw" ? condition : null,
        qty: form.get("qty"),
        overridePrice: fixed,
      });
      setError(res.error);
      if (res.error) return void toast.notSaved(res.error);
      const first = Boolean(res.first);
      setAdded({ first });
      toast.itemAdded({
        id: res.id!,
        name: item.name,
        qty: Number(form.get("qty")),
        condition: item.kind === "raw" ? condition : null,
        price: fixed ? Number(fixed.replace("$", "")) : null,
        first,
      });
    });
  if (added)
    return <Added name={item.name} first={added.first} onAgain={onClose} />;
  return (
    <form action={submit} className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-muted-foreground"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Back to results
      </button>
      <ItemHeader item={item} />
      {item.kind === "raw" && (
        <Segmented
          label="Condition"
          value={condition}
          options={CONDITIONS.map((c) => [c, c] as const)}
          onChange={setCondition}
        />
      )}
      <StockFields />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {pending ? "Adding" : "Add to stock"}
      </Button>
    </form>
  );
}

/** Qty and optional fixed price; shared with the custom item form. */
export function StockFields({
  errors = {},
}: {
  errors?: Record<string, string>;
}) {
  return (
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
  );
}

/** Inline confirmation; the store's first item gets the Direction C moment. */
export function Added(props: {
  name: string;
  first: boolean;
  onAgain?: () => void;
}) {
  const actions = (
    <div className="flex flex-wrap gap-3">
      {props.onAgain && (
        <Button type="button" size="lg" onClick={props.onAgain}>
          Add another
        </Button>
      )}
      <Link
        href="/dashboard/inventory"
        className="inline-flex min-h-12 items-center px-2 font-semibold text-brand-text"
      >
        View inventory
      </Link>
    </div>
  );
  if (props.first)
    return (
      <RipMoment kicker="Item 0001" headline="First hit logged">
        <p className="text-muted-foreground">
          Your table is live. Added {props.name} to your stock.
        </p>
        {actions}
      </RipMoment>
    );
  return (
    <div
      role="status"
      className="flex flex-col gap-4 rounded-sm bg-success-bg p-5"
    >
      <p className="flex items-center gap-2 font-semibold text-success">
        <Check aria-hidden className="size-5" />
        Added {props.name} to your stock.
      </p>
      {actions}
    </div>
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
        <h2 className="text-lg font-semibold">{item.name}</h2>
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
