"use client";

import { Coins, Layers, Percent } from "lucide-react";
import {
  startTransition,
  useActionState,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Segmented } from "@/components/segmented";
import { HangTag } from "@/components/hang-tag";
import { SectionMark } from "@/components/section-mark";
import { bento } from "@/components/bento";
import { TicketButton } from "@/components/ticket-button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usd } from "@/lib/format";
import {
  CONDITION_FIELDS,
  CONDITION_NAME,
  type ConditionPcts,
} from "@/lib/condition";
import { slugSchema, toSlug } from "@/lib/slug";
import { MODE_COPY, SELLING_MODES, type SellingMode } from "@/lib/selling-mode";
import { toast } from "@/lib/toast";
import { vendorPrice } from "@/lib/vendor-price";
import {
  saveNameAction,
  savePricingAction,
  saveSlugAction,
  saveTableAction,
  type SettingsState,
} from "./actions";

type PricingValues = {
  priceRulePct: number;
  rounding: string;
  secondCurrency: string;
  fxRate: string;
} & ConditionPcts;

const SIDES = [
  ["under", "Under market"],
  ["over", "Over market"],
] as const;

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

/**
 * One settings page's form: its own action, its own Save. Submitted by hand,
 * because a form action would reset the fields after saving and desync the
 * controlled inputs.
 */
function SettingsShell(props: {
  action: (prev: SettingsState, form: FormData) => Promise<SettingsState>;
  children: (errors: Record<string, string>) => ReactNode;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    props.action,
    {},
  );
  const e = state.errors ?? {};
  useEffect(() => {
    // A save shows the inline "Saved." instead of a toast.
    if (state.errors) toast.notSaved(saveError(state.errors));
  }, [state]);
  return (
    <form
      className="flex flex-col gap-10"
      onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        startTransition(() => action(data));
      }}
    >
      {props.children(e)}
      <Err id="form-error" msg={e.form} />
      <div className="flex items-center gap-4">
        <TicketButton type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Saving" : "Save"}
        </TicketButton>
        <p role="status" className="text-sm font-semibold text-success">
          {state.saved && !pending ? "Saved." : ""}
        </p>
      </div>
    </form>
  );
}

export function PricingForm({ values }: { values: PricingValues }) {
  return (
    <SettingsShell action={savePricingAction}>
      {(e) => (
        // Fieldsets sit in plain tiles: a legend rides the fieldset's own edge.
        <div className={bento}>
          <div>
            <PricingFields values={values} errors={e} />
          </div>
          <div>
            <ConditionFields values={values} errors={e} />
          </div>
          <div>
            <CurrencyFields values={values} errors={e} />
          </div>
        </div>
      )}
    </SettingsShell>
  );
}

export type CheckoutValues = {
  offerDelivery: boolean;
  offerPickup: boolean;
  acceptCash: boolean;
  acceptTransfer: boolean;
  bankDetails: string;
  checkoutNote: string;
  whatsapp: string;
};

export function TableForm(props: {
  sellingMode: SellingMode;
  tableLabel: string;
  nfcEnabled: boolean;
  checkout: CheckoutValues;
}) {
  const [mode, setMode] = useState(props.sellingMode);
  return (
    <SettingsShell action={saveTableAction}>
      {(e) => (
        <div className={bento}>
          <div
            className={`flex flex-col gap-2 ${mode === "online" ? "" : "lg:col-span-2"}`}
          >
            <div className="mb-4 flex flex-col gap-2">
              <Segmented
                name="sellingMode"
                label="Where you sell"
                value={mode}
                options={SELLING_MODES.map(
                  (m) => [m, MODE_COPY[m].label] as const,
                )}
                onChange={setMode}
              />
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {MODE_COPY[mode].hint}
              </p>
            </div>
            <div className="mb-2 flex flex-col gap-2">
              <Label htmlFor="tableLabel">Table number</Label>
              <Input
                id="tableLabel"
                name="tableLabel"
                defaultValue={props.tableLabel}
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
              name="nfcEnabled"
              checked={props.nfcEnabled}
              label="I have an NFC tag on my table"
              hint={`Adds "Or tap your phone here" to your printed table sign.`}
            />
          </div>
          {/* Hidden, not unmounted, at a table: a save keeps these as they are. */}
          <div hidden={mode !== "online"}>
            <CheckoutFields
              values={props.checkout}
              errors={e}
              hidden={mode !== "online"}
            />
          </div>
        </div>
      )}
    </SettingsShell>
  );
}

function CheckoutFields(props: {
  values: CheckoutValues;
  errors: Record<string, string>;
  hidden: boolean;
}) {
  const { values: v, errors: e } = props;
  const [transfer, setTransfer] = useState(v.acceptTransfer);
  return (
    <fieldset
      hidden={props.hidden}
      className="mt-6 flex flex-col gap-2 border-t border-border pt-6 lg:mt-0 lg:border-t-0 lg:pt-0"
    >
      <legend className="font-semibold">Online orders</legend>
      <p className="mb-2 text-sm text-muted-foreground">
        What buyers can choose when they order. Leave all off to arrange it with
        each buyer yourself.
      </p>
      <Toggle
        name="offerDelivery"
        checked={v.offerDelivery}
        label="Delivery"
        hint="Buyers give an address and phone. You book the courier."
      />
      <Toggle
        name="offerPickup"
        checked={v.offerPickup}
        label="Pickup"
        hint="Buyers collect from you."
      />
      <Toggle
        name="acceptCash"
        checked={v.acceptCash}
        label="Cash on delivery or at pickup"
        hint="Buyers pay when the cards reach them."
      />
      <Toggle
        name="acceptTransfer"
        checked={v.acceptTransfer}
        onChange={setTransfer}
        label="Bank transfer"
        hint="Buyers see your account details after they order."
      />
      <div hidden={!transfer} className="mt-2 mb-2 flex flex-col gap-2">
        <Label htmlFor="bankDetails">Bank details</Label>
        <Textarea
          id="bankDetails"
          name="bankDetails"
          rows={4}
          maxLength={500}
          defaultValue={v.bankDetails}
          placeholder={"Bank and branch\nAccount name\nAccount number"}
          aria-invalid={e.bankDetails ? true : undefined}
          aria-describedby="bank-hint bank-error"
        />
        <p id="bank-hint" className="text-sm text-muted-foreground">
          Shown only to buyers who choose bank transfer.
        </p>
        <Err id="bank-error" msg={e.bankDetails} />
      </div>
      <div className="mt-2 flex flex-col gap-2">
        <Label htmlFor="checkoutNote">Note for buyers (optional)</Label>
        <Textarea
          id="checkoutNote"
          name="checkoutNote"
          rows={3}
          maxLength={300}
          defaultValue={v.checkoutNote}
          placeholder="Delivery by PickMe Flash or Uber parcel, fee paid on arrival. Pickup in Nugegoda."
          aria-invalid={e.checkoutNote ? true : undefined}
          aria-describedby="note-hint note-error"
        />
        <p id="note-hint" className="text-sm text-muted-foreground">
          Shown at checkout: couriers, areas, fees, where to pick up.
        </p>
        <Err id="note-error" msg={e.checkoutNote} />
      </div>
      <div className="mt-2 flex flex-col gap-2">
        <Label htmlFor="whatsapp">WhatsApp number (optional)</Label>
        <Input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          defaultValue={v.whatsapp}
          placeholder="+94 77 123 4567"
          aria-invalid={e.whatsapp ? true : undefined}
          aria-describedby="whatsapp-hint whatsapp-error"
        />
        <p id="whatsapp-hint" className="text-sm text-muted-foreground">
          Buyers get a button on their order to message you, for example to send
          the transfer slip.
        </p>
        <Err id="whatsapp-error" msg={e.whatsapp} />
      </div>
    </fieldset>
  );
}

export function NameForm({ name }: { name: string }) {
  return (
    <SettingsShell action={saveNameAction}>
      {(e) => (
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Store name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={name}
            maxLength={80}
            required
            aria-invalid={e.name ? true : undefined}
            aria-describedby="name-hint name-error"
          />
          <p id="name-hint" className="text-sm text-muted-foreground">
            Shown on your store page, sign and receipts. Old receipts keep the
            old name.
          </p>
          <Err id="name-error" msg={e.name} />
        </div>
      )}
    </SettingsShell>
  );
}

/** The store link; the old one keeps working and sends buyers here. */
export function SlugForm({ slug, host }: { slug: string; host: string }) {
  const [value, setValue] = useState(slug);
  const check = slugSchema.safeParse(value);
  return (
    <SettingsShell action={saveSlugAction}>
      {(e) => {
        const err = check.success ? e.slug : check.error.issues[0]?.message;
        return (
          <div className="flex flex-col gap-2">
            <Label htmlFor="slug">Store link</Label>
            <div className="flex h-12 items-center bg-bg pl-3.5 shadow-[inset_0_0_0_1.5px_var(--border-strong)] focus-within:shadow-[inset_0_0_0_2.5px_var(--focus)] has-aria-invalid:shadow-[inset_0_0_0_2px_var(--danger)]">
              <span className="text-base text-muted-foreground select-none">
                {host}/
              </span>
              <Input
                id="slug"
                name="slug"
                required
                maxLength={40}
                value={value}
                onChange={(ev) => setValue(toSlug(ev.target.value))}
                aria-invalid={err ? true : undefined}
                aria-describedby="slug-hint slug-error"
                className="h-full bg-transparent pl-0.5 shadow-none focus-visible:shadow-none aria-invalid:shadow-none"
              />
            </div>
            <p id="slug-hint" className="text-sm text-muted-foreground">
              Lowercase letters, numbers and dashes. Your old link and printed
              signs keep working and send buyers to the new one. Print a new
              sign when you can.
            </p>
            <Err id="slug-error" msg={err} />
          </div>
        );
      }}
    </SettingsShell>
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
  onChange?: (on: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2">
      <input
        type="checkbox"
        name={props.name}
        defaultChecked={props.checked}
        onChange={(ev) => props.onChange?.(ev.target.checked)}
        className="mt-0.5 size-6 shrink-0 accent-[var(--sun)]"
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{props.label}</span>
        <span className="text-sm text-muted-foreground">{props.hint}</span>
      </span>
    </label>
  );
}

type FieldsProps = { values: PricingValues; errors: Record<string, string> };

function PricingFields({ values, errors: e }: FieldsProps) {
  // A phone's number pad has no minus key, so the sign is a choice and the
  // field only takes the size. The saved rule is still one signed number.
  const [side, setSide] = useState<"under" | "over">(
    values.priceRulePct > 0 ? "over" : "under",
  );
  const [pct, setPct] = useState(String(Math.abs(values.priceRulePct)));
  const [rounding, setRounding] = useState(values.rounding);
  const size = Math.abs(Number(pct.trim()));
  // Not a number goes through as typed, so the server says what's wrong.
  const signed =
    !pct.trim() || Number.isNaN(size)
      ? pct
      : String(side === "under" ? -size : size);
  const example = vendorPrice(
    48.1,
    Number(signed) || 0,
    Number(rounding),
    null,
  );
  return (
    <fieldset className="flex flex-col gap-4">
      <SectionMark n={1} level="legend" className="mb-4" icon={Percent}>
        Price rule
      </SectionMark>
      <Segmented
        label="Sell"
        name="priceRuleSide"
        value={side}
        options={SIDES}
        onChange={setSide}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="priceRuleSize">
          {side === "under" ? "Percent under market" : "Percent over market"}
        </Label>
        <Input
          id="priceRuleSize"
          inputMode="numeric"
          value={pct}
          onChange={(ev) => setPct(ev.target.value)}
          aria-invalid={e.priceRulePct ? true : undefined}
          aria-describedby="rule-hint rule-error"
          className="max-w-32"
        />
        <input type="hidden" name="priceRulePct" value={signed} />
        <p id="rule-hint" className="text-sm text-muted-foreground">
          0 matches market.
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

function ConditionFields({ values, errors: e }: FieldsProps) {
  return (
    <fieldset className="flex flex-col gap-4">
      <SectionMark n={2} level="legend" className="mb-4" icon={Layers}>
        Played cards
      </SectionMark>
      <p className="text-sm text-muted-foreground">
        Market prices are for Near Mint. A played single is priced at this share
        of it, then your price rule and rounding apply.
      </p>
      <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {CONDITION_FIELDS.map(([code, field]) => (
          <div key={field} className="flex flex-col gap-2">
            <Label htmlFor={field}>
              {CONDITION_NAME[code]} ({code}), %
            </Label>
            <Input
              id={field}
              name={field}
              inputMode="numeric"
              defaultValue={values[field]}
              aria-invalid={e[field] ? true : undefined}
              aria-describedby={`${field}-error`}
            />
            <Err id={`${field}-error`} msg={e[field]} />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function CurrencyFields({ values, errors: e }: FieldsProps) {
  return (
    <fieldset className="flex flex-col gap-4">
      <SectionMark n={3} level="legend" className="mb-4" icon={Coins}>
        Second currency
      </SectionMark>
      <p className="text-sm text-muted-foreground">
        Buyers see an approximate price in your currency next to USD. Leave
        blank to show USD only.
      </p>
      <div className="grid max-w-md grid-cols-[7rem_1fr] gap-3">
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
