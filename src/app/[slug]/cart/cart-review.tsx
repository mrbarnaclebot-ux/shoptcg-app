"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { CardThumb } from "@/components/card-thumb";
import { Stepper } from "@/components/stepper";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CheckoutErrors, Fulfil, PayWith } from "@/lib/checkout";
import { altPrice, formatAlt, usdTag } from "@/lib/fx";
import { modeCopy, type SellingMode } from "@/lib/selling-mode";
import { clearDetails, saveDetails, useDetails } from "../buyer-details";
import { useLines, writeList } from "../list-island";
import { rememberSent } from "../sent-stub";
import { sendRequest, startBuyerSession } from "./actions";
import { CheckoutFields } from "./checkout-fields";

export type ReviewItem = {
  id: string;
  name: string;
  meta: string;
  kind: "raw" | "graded" | "sealed" | "other";
  imageUrl: string | null;
  price: number | null;
  available: number;
};

type ReviewStore = {
  slug: string;
  name: string;
  isOpen: boolean;
  currency: string | null;
  fxRate: number | null;
  mode: SellingMode;
  fulfils: readonly Fulfil[];
  pays: readonly PayWith[];
  checkoutNote: string | null;
};

type Errors = { name?: string; email?: string } & CheckoutErrors;
const FIELD_ORDER = ["name", "email", "fulfil", "address", "phone", "payWith"];

const noop = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm font-semibold text-danger">
      {message}
    </p>
  );
}

/** "Not you?": drops the kept details and empties what they filled in. */
function forget(form: HTMLFormElement | null) {
  clearDetails();
  for (const k of ["name", "email", "phone", "address"]) {
    const el = form?.elements.namedItem(k);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
      el.value = "";
  }
  // The button goes with the details, so focus goes to the first field.
  (form?.elements.namedItem("name") as HTMLElement | null)?.focus();
}

/** The cart's lines and form as blocks, before the phone's cart is read. */
function CartSkeleton({ rows }: { rows: number }) {
  return (
    <div className="paper flex flex-col gap-5 p-5">
      <p role="status" className="sr-only">
        Loading the cart
      </p>
      <ul aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <li
            key={i}
            className="grid grid-cols-[40px_1fr_auto] gap-3 border-b border-border py-3 first:pt-0"
          >
            <span className="aspect-[63/88] w-10 animate-pulse bg-surface" />
            <span className="flex flex-col gap-2">
              <span className="h-4 w-3/4 bg-surface" />
              <span className="h-3 w-1/2 bg-surface" />
              <span className="mt-1 h-11 w-[8.25rem] bg-surface" />
            </span>
            <span className="mt-12 h-4 w-14 bg-surface" />
          </li>
        ))}
      </ul>
      <span aria-hidden className="ml-auto h-8 w-28 bg-surface" />
      {[0, 1].map((i) => (
        <span key={i} aria-hidden className="flex flex-col gap-2">
          <span className="h-4 w-32 bg-surface" />
          <span className="h-12 bg-surface" />
        </span>
      ))}
      <span aria-hidden className="h-12 bg-surface" />
    </div>
  );
}

export function CartReview(props: {
  store: ReviewStore;
  items: ReviewItem[];
  loaded: string[];
  maxLines: number;
}) {
  const { store, items, loaded, maxLines } = props;
  const router = useRouter();
  const hydrated = useHydrated();
  const lines = useLines(store.slug);
  const saved = useDetails();
  const form = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<string | null>(null);

  // The list lives on the phone, so a bare or stale URL asks for what's on it.
  const ids = Object.keys(lines).join(",");
  // Against what the server read, not the URL: it reads only the first maxLines.
  const read = loaded.slice(0, maxLines);
  const stale = Object.keys(lines)
    .slice(0, maxLines)
    .some((id) => !read.includes(id));
  useEffect(() => {
    startBuyerSession().catch(() => {});
  }, []);
  useEffect(() => {
    if (stale) router.replace(`/${store.slug}/cart?ids=${ids}`);
  }, [stale, ids, store.slug, router]);

  // The cart lives on the phone, so the server can only draw its shape.
  if (!hydrated) return <CartSkeleton rows={Math.max(1, items.length)} />;

  const copy = modeCopy(store.mode);
  const closedCopy = `${store.name} just closed. Your cart is saved on this phone.`;
  const rows = items
    .filter((it) => lines[it.id])
    .map((it) => {
      const gone = !it.available || it.price === null;
      return {
        ...it,
        gone,
        qty: gone ? 0 : Math.min(lines[it.id].qty, it.available),
        cut: !gone && lines[it.id].qty > it.available,
      };
    });
  // On the phone but not in this read: hidden, deleted, or past the request's limit.
  const missing = stale
    ? []
    : Object.keys(lines).filter((id) => !items.some((it) => it.id === id));
  const overLimit = (id: string) => Object.keys(lines).indexOf(id) >= maxLines;
  if (!rows.length && !missing.length)
    return (
      <p className="text-lg">
        Your cart is empty. Tap the plus on any card to add it.
      </p>
    );

  const sendable = rows.filter((r) => !r.gone);
  const total = sendable.reduce((s, r) => s + r.price! * r.qty, 0);
  const alt = altPrice(total, store.fxRate);
  const setQty = (id: string, qty: number) =>
    writeList(store.slug, { ...lines, [id]: { ...lines[id], qty } });
  const remove = (id: string) => {
    const next = { ...lines };
    delete next[id];
    writeList(store.slug, next);
  };

  const send = (form: HTMLFormElement) =>
    start(async () => {
      setBanner(null);
      const data = new FormData(form);
      data.set(
        "lines",
        JSON.stringify(sendable.map((r) => ({ listingId: r.id, qty: r.qty }))),
      );
      const res = await sendRequest(store.slug, data).catch(() => null);
      if (!res)
        return setBanner("Couldn't send. Check your connection and try again.");
      if ("fieldErrors" in res) {
        setErrors(res.fieldErrors);
        const e: Record<string, string | undefined> = res.fieldErrors;
        const first = FIELD_ORDER.find((k) => e[k]);
        const el = first && form.elements.namedItem(first);
        // A radio group comes back as a list: focus its first option.
        if (el instanceof RadioNodeList) (el[0] as HTMLElement)?.focus();
        else if (el instanceof HTMLElement) el.focus();
        return;
      }
      setErrors({});
      if ("ok" in res) {
        // Kept on the phone: the way back to this request, and next time's form.
        rememberSent(store.slug, { id: res.id, code: res.code });
        saveDetails(data);
        writeList(store.slug, {});
        router.push(`/${store.slug}/request/${res.id}`);
      } else if ("closed" in res) setBanner(closedCopy);
      else if ("limited" in res)
        setBanner(
          "Too many requests from this phone. Wait a minute and try again.",
        );
      // Taken: fresh availability marks the lines and relabels the button.
      else router.refresh();
    });

  return (
    <div className="paper flex flex-col gap-5 p-5">
      <ul>
        {rows.map((r) => (
          <li
            key={r.id}
            className="grid grid-cols-[40px_1fr_auto] gap-3 border-b border-border py-3 first:pt-0"
          >
            <CardThumb src={r.imageUrl} kind={r.kind} />
            <div className="min-w-0">
              <p className="font-semibold">{r.name}</p>
              <p className="num text-sm text-muted-foreground">{r.meta}</p>
              {r.gone ? (
                <p className="mt-2 font-semibold">
                  Just taken by another buyer
                </p>
              ) : (
                <div className="mt-2">
                  {/* A stepper stuck at one is noise, as on the item page. */}
                  {r.available > 1 ? (
                    <Stepper
                      label={`Quantity of ${r.name}`}
                      value={r.qty}
                      min={1}
                      max={r.available}
                      onStep={(d) => setQty(r.id, r.qty + d)}
                    />
                  ) : (
                    !r.cut && (
                      <p className="text-sm text-muted-foreground">Last one</p>
                    )
                  )}
                  {r.cut && (
                    <p role="status" className="mt-2 font-semibold">
                      Only {r.available} left, so we lowered this.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end justify-between gap-2">
              <button
                type="button"
                aria-label={`Remove ${r.name}`}
                onClick={() => remove(r.id)}
                className="-mt-2 -mr-2 grid size-11 place-items-center"
              >
                <X aria-hidden className="size-5" />
              </button>
              <span className="num font-semibold">
                {usdTag(r.gone ? 0 : r.price! * r.qty)}
              </span>
            </div>
          </li>
        ))}
        {missing.map((id) => (
          <li
            key={id}
            className="flex items-start justify-between gap-3 border-b border-border py-3 first:pt-0"
          >
            <p className="font-semibold">
              {lines[id].name ?? "An item in your cart"}
              {overLimit(id)
                ? ` won't be sent. A request holds ${maxLines} cards.`
                : " is no longer for sale."}
            </p>
            <button
              type="button"
              aria-label={`Remove ${lines[id].name ?? "this item"}`}
              onClick={() => remove(id)}
              className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center"
            >
              <X aria-hidden className="size-5" />
            </button>
          </li>
        ))}
      </ul>
      <div>
        <p className="flex items-baseline justify-between font-semibold">
          {copy.cartTotal}
          <span className="font-display num text-[2rem] leading-none font-extrabold">
            {usdTag(total)}
          </span>
        </p>
        {store.currency && alt !== null && (
          <p className="num text-right text-sm text-muted-foreground">
            approx. {formatAlt(store.currency, alt)}
          </p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">{copy.adjust}</p>
      </div>
      {!store.isOpen ? (
        <p role="alert" className="font-semibold">
          {closedCopy}
        </p>
      ) : (
        <form
          ref={form}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(e.currentTarget);
          }}
        >
          {(saved.name || saved.email) && (
            <p className="flex flex-wrap items-center justify-between gap-x-3 text-sm text-muted-foreground">
              Filled in from last time, on this phone only.
              <button
                type="button"
                onClick={() => forget(form.current)}
                className="min-h-11 font-semibold text-text underline decoration-brand-text decoration-[1.5px] underline-offset-4"
              >
                Not you? Clear
              </button>
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              maxLength={80}
              defaultValue={saved.name}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby="name-help name-error"
            />
            <p id="name-help" className="text-sm text-muted-foreground">
              {copy.nameHelp}
            </p>
            <FieldError id="name-error" message={errors.name} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email for your receipt</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              defaultValue={saved.email}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby="email-error"
            />
            <FieldError id="email-error" message={errors.email} />
          </div>
          <CheckoutFields
            fulfils={store.fulfils}
            pays={store.pays}
            note={store.checkoutNote}
            saved={saved}
            errors={errors}
          />
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="promo"
              className="mt-0.5 size-6 shrink-0 accent-brand"
            />
            Email me when {store.name} has new stock or deals. Unsubscribe any
            time.
          </label>
          <p className="text-sm text-muted-foreground">
            By sending, you share your name
            {store.fulfils.length
              ? ", email and contact details"
              : " and email"}{" "}
            with {store.name} for this request and your receipt. See{" "}
            <Link
              href="/terms"
              className="text-text underline decoration-brand-text decoration-[1.5px] underline-offset-4"
            >
              Terms
            </Link>
            .
          </p>
          {banner && (
            <p role="alert" className="font-semibold text-danger">
              {banner}
            </p>
          )}
          <TicketButton
            type="submit"
            disabled={pending || !sendable.length}
            aria-busy={pending}
          >
            {pending
              ? "Sending"
              : sendable.length < rows.length + missing.length
                ? "Send without it"
                : "Send to seller"}
          </TicketButton>
          <p className="text-sm text-muted-foreground">{copy.holdNote}</p>
        </form>
      )}
    </div>
  );
}
