"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { CardThumb } from "@/components/card-thumb";
import { Segmented } from "@/components/segmented";
import { Stepper } from "@/components/stepper";
import { StubValue, Ticket } from "@/components/ticket";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaymentMethod } from "@/db/schema";
import {
  FULFIL_LABEL,
  payLabel,
  type Fulfil,
  type PayWith,
} from "@/lib/checkout";
import { usd } from "@/lib/format";
import { altPrice, formatAlt } from "@/lib/fx";
import { fromCents, PRICE_RE, priceSale, toCents } from "@/lib/money";
import { shortName } from "@/lib/short-name";
import { toast } from "@/lib/toast";
import { clock, useLive, useNow } from "@/lib/use-live";
import { declineAction } from "../actions";
import { confirmSaleAction } from "./actions";

export type DraftLine = {
  listingId: string;
  name: string;
  meta: string;
  number: string | null;
  kind: "raw" | "graded" | "sealed";
  imageUrl: string | null;
  qty: number;
  price: string;
  /** What stock can give this request, after other buyers' holds. */
  left: number;
  /** Another buyer's live hold takes some of the stock. */
  held: boolean;
};

type Edit = { qty: number; price: string; removed: boolean };

const METHODS = [
  ["cash", "Cash"],
  ["card", "Card"],
  ["transfer", "Transfer (PayPal, bank)"],
  ["other", "Other"],
] as const;

const DISCOUNTS = [
  ["none", "None"],
  ["amount", "$"],
  ["percent", "%"],
] as const;

const money = (cents: number) => usd(Number(fromCents(cents)));

function LineRow(props: {
  line: DraftLine;
  edit: Edit;
  canRemove: boolean;
  onChange: (patch: Partial<Edit>) => void;
}) {
  const { line: l, edit: e } = props;
  const price = useRef<HTMLInputElement>(null);
  // A price typed before hydration sits in the field but reaches no handler, and
  // the next render would undo it. Adopt it, like Segmented does for a tap.
  useLayoutEffect(() => {
    const typed = price.current?.value;
    if (typed !== undefined && typed !== e.price)
      props.onChange({ price: typed });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, at hydration
  }, []);
  if (e.removed)
    return (
      <li className="flex min-h-11 items-center justify-between gap-3 border-t border-border py-2 text-muted-foreground">
        <s className="min-w-0">{l.name}</s>
        <button
          type="button"
          onClick={() => props.onChange({ removed: false })}
          className="min-h-11 font-semibold underline underline-offset-4"
        >
          Put back
        </button>
      </li>
    );
  const short = e.qty > l.left;
  const stock =
    l.left === 0
      ? l.held
        ? "Held for another buyer. Decline that request or wait."
        : "No longer in stock"
      : l.left < l.qty
        ? `Only ${l.left} of ${l.qty} left`
        : null;
  const changed = toCents(e.price) !== toCents(l.price);
  const priceId = `price-${l.listingId}`;
  return (
    <li className="grid grid-cols-[40px_1fr] gap-x-3 gap-y-2 border-t border-border py-3">
      <CardThumb src={l.imageUrl} kind={l.kind} number={l.number} />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{l.name}</p>
          <p className="num text-sm text-muted-foreground">{l.meta}</p>
          {stock && (
            <p
              role={short ? "alert" : "status"}
              className={`mt-1 font-semibold ${short ? "text-danger" : ""}`}
            >
              {stock}
            </p>
          )}
        </div>
        {props.canRemove && (
          <button
            type="button"
            onClick={() => props.onChange({ removed: true })}
            aria-label={`Remove ${l.name}`}
            className="min-h-11 shrink-0 font-semibold underline underline-offset-4"
          >
            Remove
          </button>
        )}
      </div>
      <div className="col-span-2 flex items-end justify-between gap-3">
        <Stepper
          label={`Quantity of ${l.name}`}
          value={e.qty}
          min={1}
          max={l.qty}
          onStep={(d) => props.onChange({ qty: e.qty + d })}
        />
        <div className="flex max-w-44 min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <Label htmlFor={priceId}>Price</Label>
            {changed && (
              <span className="num text-sm whitespace-nowrap text-muted-foreground">
                was <s>{usd(Number(l.price))}</s>
              </span>
            )}
          </div>
          <Input
            id={priceId}
            ref={price}
            inputMode="decimal"
            autoComplete="off"
            value={e.price}
            onChange={(v) => props.onChange({ price: v.target.value })}
            aria-label={`Price each for ${l.name}`}
            aria-invalid={!PRICE_RE.test(e.price) || undefined}
            className="num"
          />
        </div>
      </div>
    </li>
  );
}

function DeclineRequest({ id }: { id: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  if (!asking)
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="min-h-11 self-start font-semibold text-danger underline underline-offset-4"
      >
        Decline request
      </button>
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">Decline and release items?</p>
      <div className="flex flex-wrap gap-3">
        <TicketButton
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await declineAction(id).catch(() => false);
              router.push("/dashboard");
            })
          }
        >
          Decline
        </TicketButton>
        <TicketButton variant="secondary" onClick={() => setAsking(false)}>
          Keep
        </TicketButton>
      </div>
    </div>
  );
}

export function SaleForm(props: {
  request: {
    id: string;
    code: string;
    buyerName: string;
    isTest: boolean;
    expiresAt: number;
    fulfil: Fulfil | null;
    payWith: PayWith | null;
    phone: string | null;
    address: string | null;
  };
  lines: DraftLine[];
  currency: string | null;
  fxRate: number | null;
}) {
  const { request: r, lines } = props;
  const router = useRouter();
  const now = useNow();
  // A cancel or a rival sale while the seller is editing shows up here.
  useLive("/api/live/store");
  const [edits, setEdits] = useState<Record<string, Edit>>(() =>
    Object.fromEntries(
      lines.map((l) => [
        l.listingId,
        {
          qty: l.left > 0 ? Math.min(l.qty, l.left) : l.qty,
          price: l.price,
          removed: false,
        },
      ]),
    ),
  );
  const [discountKind, setKind] = useState<"none" | "amount" | "percent">(
    "none",
  );
  const [discountValue, setValue] = useState("");
  // What the buyer said they'd pay with; the seller can still change it.
  const [method, setMethod] = useState<PaymentMethod | null>(r.payWith);
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  const kept = lines.filter((l) => !edits[l.listingId].removed);
  const shortLines = kept.filter((l) => edits[l.listingId].qty > l.left);
  const chosen = kept.map((l) => ({
    listingId: l.listingId,
    qty: edits[l.listingId].qty,
    unitPrice: edits[l.listingId].price.trim(),
  }));
  const discount =
    discountKind === "none"
      ? { kind: discountKind }
      : { kind: discountKind, value: discountValue.trim() };
  // Blank means "no discount yet", not an error, while the seller is typing.
  const typing = discountKind !== "none" && !discountValue.trim();
  const priced = priceSale(chosen, typing ? { kind: "none" } : discount);
  const noteOk = method !== "other" || note.trim().length > 0;
  const over = Boolean(now) && r.expiresAt <= now;
  const alt = priced
    ? altPrice(Number(fromCents(priced.total)), props.fxRate)
    : null;
  const ready = Boolean(
    priced && method && noteOk && !shortLines.length && !typing,
  );
  const helper = !method
    ? "Pick how they paid."
    : !noteOk
      ? "Say how they paid."
      : typing
        ? "Enter the discount, or pick None."
        : !priced
          ? "Check the prices and the discount."
          : !shortLines.length
            ? null
            : kept.length > 1
              ? "Remove what's no longer here."
              : "Decline this request, or wait for stock.";
  // Only the discount: a bad line price is flagged on its own field.
  const badDiscount =
    !typing && !priced && Boolean(priceSale(chosen, { kind: "none" }));

  const patch = (id: string, p: Partial<Edit>) =>
    setEdits((all) => ({ ...all, [id]: { ...all[id], ...p } }));

  const confirm = () =>
    start(async () => {
      setFailed(false);
      const id = toast.saleRecording();
      const res = await confirmSaleAction({
        requestId: r.id,
        lines: chosen,
        discount,
        method,
        note: method === "other" ? note.trim() : undefined,
      }).catch(() => null);
      if (res && "ok" in res) {
        toast.saleRecorded(id, res.receiptNo, usd(Number(res.total)));
        router.push(`/dashboard/sales/${res.saleId}`);
        return;
      }
      toast.dismiss(id);
      // Fresh stock marks the short lines; a closed request shows its page.
      if (res && ("stock" in res || "gone" in res)) router.refresh();
      else {
        setFailed(true);
        // No retry here: it would keep these values after the seller edits.
        toast.saleFailed();
      }
    });

  return (
    <>
      <h1 className="font-display text-[3rem] leading-[0.9] font-black [overflow-wrap:anywhere]">
        Sale for {shortName(r.buyerName)}
      </h1>
      {r.isTest && (
        <p role="status" className="font-semibold">
          This is a test request, so nothing can sell. Decline it to put the
          items back.
        </p>
      )}
      {over && !r.isTest && (
        <p role="status" className="font-semibold">
          The hold ended, but nothing has sold. You can still confirm if the
          items are here.
        </p>
      )}
      <div className="flex gap-8">
        <StubValue k="Code" v={r.code} testId="sale-code" />
        <StubValue k="Hold" v={over ? "Over" : clock(r.expiresAt, now)} />
      </div>
      {(r.fulfil || r.payWith || r.phone) && (
        <section
          aria-label="Delivery and payment"
          className="flex flex-col gap-1 [overflow-wrap:anywhere]"
        >
          <p className="font-semibold">
            {[
              r.fulfil && FULFIL_LABEL[r.fulfil],
              r.payWith && payLabel(r.payWith, r.fulfil),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {r.address && <p className="whitespace-pre-line">{r.address}</p>}
          {r.phone && (
            <a
              href={`tel:${r.phone.replace(/[^+0-9]/g, "")}`}
              className="num self-start font-semibold underline decoration-brand-text decoration-[1.5px] underline-offset-4"
            >
              {r.phone}
            </a>
          )}
        </section>
      )}
      <Ticket as="div">
        <ul>
          {lines.map((l) => (
            <LineRow
              key={l.listingId}
              line={l}
              edit={edits[l.listingId]}
              canRemove={kept.length > 1}
              onChange={(p) => patch(l.listingId, p)}
            />
          ))}
        </ul>
      </Ticket>
      <Segmented
        label="Discount"
        name="discount"
        value={discountKind}
        options={DISCOUNTS}
        onChange={setKind}
      />
      {discountKind !== "none" && (
        <div className="flex w-36 flex-col gap-2">
          <Label htmlFor="discount-value">
            {discountKind === "percent" ? "Percent off" : "Dollars off"}
          </Label>
          <Input
            id="discount-value"
            inputMode="decimal"
            autoComplete="off"
            className="num"
            value={discountValue}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={badDiscount || undefined}
          />
        </div>
      )}
      <Segmented
        label="How they paid"
        name="method"
        value={method ?? ("" as PaymentMethod)}
        options={METHODS}
        onChange={setMethod}
      />
      {method === "other" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="payment-note">What did they pay with?</Label>
          <Input
            id="payment-note"
            maxLength={40}
            autoComplete="off"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}
      <dl className="flex flex-col gap-1 border-t-[1.5px] border-text pt-3">
        <div className="flex justify-between text-muted-foreground">
          <dt>Subtotal</dt>
          <dd className="num">{priced ? money(priced.subtotal) : "-"}</dd>
        </div>
        {priced && priced.discount > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <dt>Discount</dt>
            <dd className="num">-{money(priced.discount)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between font-semibold">
          <dt>Total</dt>
          <dd className="font-display num text-[2.5rem] leading-none font-extrabold">
            {priced ? money(priced.total) : "-"}
          </dd>
        </div>
        {props.currency && alt !== null && (
          <div className="num text-right text-sm text-muted-foreground">
            <dt className="sr-only">In {props.currency}</dt>
            <dd>approx. {formatAlt(props.currency, alt)}</dd>
          </div>
        )}
      </dl>
      {!r.isTest && (
        <div
          data-toast-clear
          className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex flex-col gap-2 border-t border-border bg-bg px-4 py-3 lg:bottom-0"
        >
          {failed && (
            <p role="alert" className="font-semibold text-danger">
              Couldn&apos;t confirm the sale saved. Tap Confirm again; it
              won&apos;t record twice.
            </p>
          )}
          <TicketButton disabled={!ready || pending} onClick={confirm}>
            {pending
              ? "Recording"
              : `Confirm sale${priced ? `, ${money(priced.total)}` : ""}`}
          </TicketButton>
          <p className="text-sm">
            {helper ?? "This can't be changed after you confirm."}
          </p>
        </div>
      )}
      <DeclineRequest id={r.id} />
    </>
  );
}
