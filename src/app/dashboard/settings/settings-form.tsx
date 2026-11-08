"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usd } from "@/lib/format";
import { vendorPrice } from "@/lib/vendor-price";
import { saveSettingsAction, type SettingsState } from "./actions";

type Values = {
  priceRulePct: number;
  rounding: string;
  secondCurrency: string;
  fxRate: string;
  nfcEnabled: boolean;
  isOpen: boolean;
};

const ROUNDING = [
  { value: "0", label: "Exact cents" },
  { value: "0.5", label: "Nearest $0.50" },
  { value: "1", label: "Nearest $1" },
];

function Err({ id, msg }: { id: string; msg?: string }) {
  return msg ? (
    <p id={id} className="text-sm text-danger">
      {msg}
    </p>
  ) : null;
}

export function SettingsForm({ values }: { values: Values }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveSettingsAction,
    {},
  );
  const e = state.errors ?? {};
  return (
    <form action={action} className="flex flex-col gap-8">
      <PricingFields values={values} errors={e} />
      <CurrencyFields values={values} errors={e} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-3 text-xl font-bold wdth-108">
          At the table
        </legend>
        <Toggle
          name="isOpen"
          checked={values.isOpen}
          label="Store open"
          hint="Closed stores can still be browsed, but buyers can't send requests."
        />
        <Toggle
          name="nfcEnabled"
          checked={values.nfcEnabled}
          label="I have an NFC tag on my table"
          hint={`Adds "Or tap your phone here" to your printed table sign.`}
        />
      </fieldset>

      <Err id="form-error" msg={e.form} />
      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
          {pending ? "Saving" : "Save settings"}
        </Button>
        <p role="status" className="text-sm font-semibold text-success">
          {state.saved && !pending ? "Saved." : ""}
        </p>
      </div>
    </form>
  );
}

function Toggle(props: {
  name: string;
  checked: boolean;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md py-2">
      <input
        type="checkbox"
        name={props.name}
        defaultChecked={props.checked}
        className="mt-0.5 size-6 shrink-0 accent-brand"
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{props.label}</span>
        <span className="text-sm text-subtle">{props.hint}</span>
      </span>
    </label>
  );
}

type FieldsProps = { values: Values; errors: Record<string, string> };

function PricingFields({ values, errors: e }: FieldsProps) {
  const [pct, setPct] = useState(String(values.priceRulePct));
  const [rounding, setRounding] = useState(values.rounding);
  const example = vendorPrice(48.1, Number(pct) || 0, Number(rounding), null);
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-4 text-xl font-bold wdth-108">Pricing</legend>
      <div className="flex flex-col gap-2">
        <Label htmlFor="priceRulePct">Price rule (% of market)</Label>
        <Input
          id="priceRulePct"
          name="priceRulePct"
          inputMode="numeric"
          value={pct}
          onChange={(ev) => setPct(ev.target.value)}
          aria-invalid={e.priceRulePct ? true : undefined}
          aria-describedby="rule-hint rule-error"
          className="max-w-32"
        />
        <p id="rule-hint" className="text-sm text-subtle">
          Use -10 to sell 10% under market, 0 to match it.
        </p>
        <Err id="rule-error" msg={e.priceRulePct} />
      </div>
      <div
        className="flex flex-col gap-2"
        role="radiogroup"
        aria-label="Rounding"
      >
        <span className="text-sm font-medium">Rounding</span>
        <div className="grid grid-cols-3 gap-2">
          {ROUNDING.map((r) => (
            <label
              key={r.value}
              className="flex min-h-12 cursor-pointer items-center justify-center rounded-md border border-border-strong bg-surface-2 px-2 text-center text-sm font-semibold has-checked:border-brand has-checked:bg-brand-bg has-checked:text-sunrise-200 has-focus-visible:ring-2 has-focus-visible:ring-focus"
            >
              <input
                type="radio"
                name="rounding"
                value={r.value}
                checked={rounding === r.value}
                onChange={() => setRounding(r.value)}
                className="sr-only"
              />
              {r.label}
            </label>
          ))}
        </div>
      </div>
      <p
        className="rounded-md bg-surface px-4 py-3 text-sm text-muted-foreground"
        aria-live="polite"
      >
        A card at <span className="num text-text">$48.10</span> market sells for{" "}
        <span className="num text-text">
          {example === null ? "-" : usd(example)}
        </span>
        . Fixed prices you set on an item always win.
      </p>
    </fieldset>
  );
}

function CurrencyFields({ values, errors: e }: FieldsProps) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 text-xl font-bold wdth-108">
        Second currency
      </legend>
      <p className="text-sm text-subtle">
        Buyers see an approximate price in your currency next to USD. Leave
        blank to show USD only.
      </p>
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="secondCurrency">Code</Label>
          <Input
            id="secondCurrency"
            name="secondCurrency"
            defaultValue={values.secondCurrency}
            maxLength={3}
            placeholder="AUD"
            autoCapitalize="characters"
            aria-invalid={e.secondCurrency ? true : undefined}
            aria-describedby="currency-error"
            className="uppercase"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="fxRate">Your rate for 1 USD</Label>
          <Input
            id="fxRate"
            name="fxRate"
            inputMode="decimal"
            defaultValue={values.fxRate}
            placeholder="1.52"
            aria-invalid={e.fxRate ? true : undefined}
            aria-describedby="fx-error"
          />
        </div>
      </div>
      <Err id="currency-error" msg={e.secondCurrency} />
      <Err id="fx-error" msg={e.fxRate} />
    </fieldset>
  );
}
