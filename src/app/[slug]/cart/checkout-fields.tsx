"use client";

import { useState } from "react";
import { Segmented } from "@/components/segmented";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FULFIL_LABEL,
  payLabel,
  type CheckoutErrors,
  type Fulfil,
  type PayWith,
} from "@/lib/checkout";

function Err({ id, msg }: { id: string; msg?: string }) {
  return msg ? (
    <p id={id} className="text-sm font-semibold text-danger">
      {msg}
    </p>
  ) : null;
}

/** Delivery or pickup, and how to pay, from what the store offers. */
export function CheckoutFields(props: {
  fulfils: readonly Fulfil[];
  pays: readonly PayWith[];
  note: string | null;
  errors: CheckoutErrors;
}) {
  const { fulfils, pays, errors: e } = props;
  // One option is a fact the buyer reads, not a question.
  const [fulfil, setFulfil] = useState<Fulfil | "">(
    fulfils.length === 1 ? fulfils[0] : "",
  );
  const [pay, setPay] = useState<PayWith | "">(
    pays.length === 1 ? pays[0] : "",
  );
  const f = fulfil || null;
  return (
    <div className="flex flex-col gap-4">
      {fulfils.length > 1 && (
        <div>
          <Segmented
            label="How do you want it?"
            name="fulfil"
            value={fulfil}
            options={fulfils.map((x) => [x, FULFIL_LABEL[x]] as const)}
            onChange={setFulfil}
          />
          <Err id="fulfil-error" msg={e.fulfil} />
        </div>
      )}
      {fulfils.length === 1 && (
        <p className="font-semibold">{FULFIL_LABEL[fulfils[0]]} only</p>
      )}
      {f === "delivery" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="address">Delivery address</Label>
          <Textarea
            id="address"
            name="address"
            rows={3}
            maxLength={300}
            autoComplete="street-address"
            aria-invalid={e.address ? true : undefined}
            aria-describedby="address-error"
          />
          <Err id="address-error" msg={e.address} />
        </div>
      )}
      {f && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">
            Phone{f === "delivery" ? "" : " (optional)"}
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            aria-invalid={e.phone ? true : undefined}
            aria-describedby="phone-help phone-error"
          />
          <p id="phone-help" className="text-sm text-muted-foreground">
            {f === "delivery"
              ? "For the seller and the courier."
              : "So the seller can reach you about pickup."}
          </p>
          <Err id="phone-error" msg={e.phone} />
        </div>
      )}
      {pays.length > 1 && (
        <div>
          <Segmented
            label="How will you pay?"
            name="payWith"
            value={pay}
            options={pays.map((x) => [x, payLabel(x, f)] as const)}
            onChange={setPay}
          />
          <Err id="pay-error" msg={e.payWith} />
        </div>
      )}
      {pays.length === 1 && (
        <p className="font-semibold">
          Pay by {payLabel(pays[0], f).toLowerCase()}
        </p>
      )}
      {pay === "transfer" && (
        <p className="text-sm text-muted-foreground">
          You&apos;ll see the bank details after you send. The seller confirms
          once the money arrives.
        </p>
      )}
      {props.note && (
        <p className="text-sm whitespace-pre-line text-muted-foreground [overflow-wrap:anywhere]">
          {props.note}
        </p>
      )}
    </div>
  );
}
