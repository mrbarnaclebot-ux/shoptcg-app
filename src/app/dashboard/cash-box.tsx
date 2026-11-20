"use client";

import { headingIcon } from "@/components/bento";
import { Wallet } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { lineButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { overShort, usd } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cashCheckAction, setFloatAction } from "./actions";

export type OpenTill = {
  id: string;
  since: string;
  float: string | null;
  cashSales: string;
  cashBuys: string;
  expected: string;
};

const link =
  "min-h-11 self-start text-sm font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px] disabled:opacity-45";

function Row(props: { k: string; children: ReactNode; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border py-2">
      <dt className={props.big ? "font-semibold" : "text-muted-foreground"}>
        {props.k}
      </dt>
      <dd
        className={
          props.big
            ? "font-display num text-[1.875rem] leading-none font-extrabold"
            : "num font-semibold"
        }
      >
        {props.children}
      </dd>
    </div>
  );
}

function Amount(props: {
  id: string;
  label: string;
  submit: string;
  pending: boolean;
  onSubmit: (v: string) => void;
}) {
  const [v, setV] = useState("");
  return (
    <form
      className="flex items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit(v);
      }}
    >
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor={props.id}>{props.label}</Label>
        <Input
          id={props.id}
          inputMode="decimal"
          autoComplete="off"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="0.00"
        />
      </div>
      <button type="submit" disabled={props.pending} className={lineButton}>
        {props.submit}
      </button>
    </form>
  );
}

/**
 * The cash box: float in, cash sales, cash paid out for buys, and what should
 * be there. The cash check at close stores the count and closes the box.
 */
export function CashBox(props: { till: OpenTill | null; closing: boolean }) {
  const { till } = props;
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [done, setDone] = useState<{ counted: string; expected: string }>();

  const saveFloat = (v: string) =>
    start(async () => {
      const r = await setFloatAction(v).catch(() => ({
        error: "Couldn't reach the server. Try again.",
      }));
      if (r.error) toast.notSaved(r.error);
      else setEditing(false);
    });
  const check = (v: string) =>
    start(async () => {
      const r = await cashCheckAction(till!.id, v).catch(() => ({
        error: "Couldn't reach the server. Try again.",
        expected: undefined,
        counted: undefined,
      }));
      if (r.error || !r.expected || !r.counted)
        return void toast.notSaved(r.error ?? "Try again.");
      setChecking(false);
      setDone({ counted: r.counted, expected: r.expected });
    });

  return (
    <section
      aria-labelledby="cash-h"
      aria-busy={pending}
      className="flex flex-col gap-3 border-t border-border pt-4 lg:border-t-0 lg:pt-0"
    >
      <h2
        id="cash-h"
        className="font-display text-2xl leading-none font-extrabold"
      >
        <Wallet aria-hidden className={headingIcon} />
        Cash box
      </h2>
      {done && (
        <p role="status" className="font-semibold">
          Cash check saved. Counted {usd(Number(done.counted))}, expected{" "}
          {usd(Number(done.expected))}. {overShort(done.counted, done.expected)}
          .
        </p>
      )}
      {!till ? (
        <>
          <p className="text-sm text-muted-foreground">
            No cash box open. Opening your store starts one. Add the cash you
            start with to check it at close.
          </p>
          <Amount
            id="float-new"
            label="Float (optional)"
            submit="Start cash box"
            pending={pending}
            onSubmit={saveFloat}
          />
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Since {till.since}.</p>
          <dl className="border-b border-border">
            <Row k="Float">
              {till.float === null ? "Not set" : usd(Number(till.float))}
            </Row>
            <Row k="Cash sales">{usd(Number(till.cashSales))}</Row>
            <Row k="Cash paid for buys">
              {Number(till.cashBuys) ? "−" : ""}
              {usd(Number(till.cashBuys))}
            </Row>
            <Row k="Should be in the box" big>
              {usd(Number(till.expected))}
            </Row>
          </dl>
          {editing ? (
            <Amount
              id="float"
              label="Float"
              submit="Save"
              pending={pending}
              onSubmit={saveFloat}
            />
          ) : (
            !checking && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={link}
              >
                {till.float === null ? "Add float" : "Change float"}
              </button>
            )
          )}
          {checking || props.closing ? (
            <Amount
              id="counted"
              label="Cash you counted"
              submit="Save count"
              pending={pending}
              onSubmit={check}
            />
          ) : (
            !editing && (
              <button
                type="button"
                onClick={() => setChecking(true)}
                className={lineButton + " self-start"}
              >
                Cash check
              </button>
            )
          )}
        </>
      )}
    </section>
  );
}
