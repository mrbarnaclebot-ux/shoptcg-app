"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Segmented } from "@/components/segmented";
import { HangTag } from "@/components/hang-tag";
import { SectionMark } from "@/components/section-mark";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usd } from "@/lib/format";
import { toast } from "@/lib/toast";
import { vendorPrice } from "@/lib/vendor-price";
import { saveSettingsAction, type SettingsState } from "./actions";

type Values = {
  priceRulePct: number;
  rounding: string;
  secondCurrency: string;
  fxRate: string;
  tableLabel: string;
  nfcEnabled: boolean;
  isOpen: boolean;
};

const ROUNDING = [
  ["0", "Exact cents"],
  ["0.5", "Nearest $0.50"],
  ["1", "Nearest $1"],
] as const;

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
  useEffect(() => {
    if (state.saved) toast.settingsSaved(state.saved.pct, state.saved.rounding);
    else if (state.errors) toast.notSaved(saveError(state.errors));
  }, [state]);
  return (
    <form
      className="flex flex-col gap-10"
      // Submitted by hand: a form action would auto-reset the fields after
      // saving and desync the controlled rule and rounding inputs.
      onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <PricingFields values={values} errors={e} />
      <CurrencyFields values={values} errors={e} />

      <fieldset className="flex flex-col gap-2">
        <SectionMark n={3} level="legend" className="mb-4">
          At the table
        </SectionMark>
        <div className="mb-2 flex flex-col gap-2">
          <Label htmlFor="tableLabel">Table number</Label>
          <Input
            id="tableLabel"
            name="tableLabel"
            defaultValue={values.tableLabel}
            maxLength={8}
            placeholder="B14"
            autoCapitalize="characters"
            aria-invalid={e.tableLabel ? true : undefined}
            aria-describedby="table-hint table-error"
            className="max-w-32"
          />
          <p id="table-hint" className="text-sm text-muted-foreground">
            The number the organiser gave your table. Shown on your sign and
            store page.
          </p>
          <Err id="table-error" msg={e.tableLabel} />
        </div>
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
        <TicketButton type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Saving" : "Save settings"}
        </TicketButton>
        <p role="status" className="text-sm font-semibold text-success">
          {state.saved && !pending ? "Saved." : ""}
        </p>
      </div>
    </form>
  );
}

function saveError(errors: Record<string, string>) {
  if (errors.form) return errors.form;
  const n = Object.keys(errors).length;
  return `${n} ${n === 1 ? "field needs" : "fields need"} a fix. Your entries are still here.`;
}

function Toggle(props: {
  name: string;
  checked: boolean;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2">
      <input
        type="checkbox"
        name={props.name}
        defaultChecked={props.checked}
        className="mt-0.5 size-6 shrink-0 accent-[var(--sun)]"
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{props.label}</span>
        <span className="text-sm text-muted-foreground">{props.hint}</span>
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
      <SectionMark n={1} level="legend" className="mb-4">
        Pricing
      </SectionMark>
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
        <p id="rule-hint" className="text-sm text-muted-foreground">
          Use -10 to sell 10% under market, 0 to match it.
        </p>
        <Err id="rule-error" msg={e.priceRulePct} />
      </div>
      <Segmented
        name="rounding"
        label="Rounding"
        value={rounding}
        options={ROUNDING}
        onChange={setRounding}
      />
      {/* A worked example on a hang tag, so the rule reads as a real price. */}
      <div className="flex flex-wrap items-center gap-4 border-t border-dashed border-border-strong pt-4">
        <HangTag
          price={example === null ? "-" : usd(example)}
          sub="on a $48.10 card"
        />
        <p
          className="max-w-[30ch] text-sm text-muted-foreground"
          aria-live="polite"
        >
          A card at <span className="num text-text">$48.10</span> market sells
          for{" "}
          <span className="num font-semibold text-text">
            {example === null ? "-" : usd(example)}
          </span>
          . Fixed prices you set on an item always win.
        </p>
      </div>
    </fieldset>
  );
}

function CurrencyFields({ values, errors: e }: FieldsProps) {
  return (
    <fieldset className="flex flex-col gap-4">
      <SectionMark n={2} level="legend" className="mb-4">
        Second currency
      </SectionMark>
      <p className="text-sm text-muted-foreground">
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
