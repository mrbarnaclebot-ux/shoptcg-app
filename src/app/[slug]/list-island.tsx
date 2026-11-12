"use client";

import { ArrowLeft, Check, Plus, Share } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Stepper } from "@/components/stepper";
import { basketTag, DEVICE_ID } from "@/lib/basket-tag";

// The buyer's list lives on this phone only, per store, for 24 hours
// (SCREENS 7). It is the one client island on the public pages.

// The name is only for a row whose item has since gone; older lists lack it.
export type Line = { qty: number; price: number | null; name?: string };
type List = { at: number; lines: Record<string, Line> };

const TTL_MS = 24 * 60 * 60 * 1000;
const EVENT = "tcgmart:list";
export const LIST_EVENT = EVENT;
const key = (slug: string) => `list:${slug}`;

function read(slug: string): string {
  try {
    return localStorage.getItem(key(slug)) ?? "";
  } catch {
    return "";
  }
}

function parse(raw: string): List["lines"] {
  try {
    const list = JSON.parse(raw) as List;
    return Date.now() - list.at < TTL_MS ? list.lines : {};
  } catch {
    return {};
  }
}

export const listOn = (slug: string) => parse(read(slug));

/**
 * A random id for this browser on this store, so the seller can tell open
 * lists apart and count visitors. Per store, so it follows nobody around.
 */
export function deviceId(slug: string) {
  const k = `device:${slug}`;
  try {
    const have = localStorage.getItem(k);
    if (have && DEVICE_ID.test(have)) return have;
    const id = crypto.randomUUID().replaceAll("-", "");
    localStorage.setItem(k, id);
    return id;
  } catch {
    // Private mode: an id for this page load only.
    return (memoryId ??= Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""));
  }
}
let memoryId: string | undefined;

export function writeList(slug: string, lines: List["lines"]) {
  try {
    localStorage.setItem(key(slug), JSON.stringify({ at: Date.now(), lines }));
  } catch {
    // Private mode or full storage: the list just won't survive a reload.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// The raw string is the snapshot so React compares it by value.
export function useLines(slug: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(slug),
    () => "",
  );
  return parse(raw);
}

/** A 44px add toggle on tiles. Pressed, it turns lamp orange with a check. */
export function AddButton(props: {
  slug: string;
  id: string;
  name: string;
  price: number | null;
}) {
  const lines = useLines(props.slug);
  const on = Boolean(lines[props.id]);
  const toggle = () => {
    const next = { ...lines };
    if (on) delete next[props.id];
    else next[props.id] = { qty: 1, price: props.price, name: props.name };
    writeList(props.slug, next);
  };
  const Icon = on ? Check : Plus;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={`Add ${props.name} to your cart`}
      className={`grid size-11 shrink-0 place-items-center ${on ? "bg-brand text-on-brand" : "bg-surface text-text shadow-[inset_0_0_0_1px_var(--border-strong)]"}`}
    >
      <Icon aria-hidden className="size-5" strokeWidth={2.3} />
    </button>
  );
}

/**
 * The item page's add: a quantity when more than one is free, then the
 * full-width ticket. Once in the cart the quantity edits the cart line and the
 * ticket goes to the cart; Remove takes it out.
 */
export function CartAction(props: {
  slug: string;
  id: string;
  name: string;
  price: number;
  available: number;
}) {
  const { slug, id, available } = props;
  const lines = useLines(slug);
  const line = lines[id];
  const [pick, setPick] = useState(1);
  const qty = Math.min(line?.qty ?? pick, available);
  const put = (q: number) =>
    writeList(slug, {
      ...lines,
      [id]: { qty: q, price: props.price, name: props.name },
    });
  const remove = () => {
    const next = { ...lines };
    delete next[id];
    writeList(slug, next);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {available > 1 && (
          <Stepper
            label={`Quantity of ${props.name}`}
            value={qty}
            min={1}
            max={available}
            onStep={(d) => (line ? put(qty + d) : setPick(qty + d))}
          />
        )}
        {line ? (
          <Link
            href={`/${slug}/cart?ids=${Object.keys(lines).join(",")}`}
            className="btn-ticket min-w-0 flex-1"
          >
            <span className="btn-ticket-main">Review cart</span>
            <span aria-hidden className="btn-ticket-stub">
              <Check className="size-[18px]" strokeWidth={2.4} />
            </span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => put(qty)}
            className="btn-ticket min-w-0 flex-1"
          >
            <span className="btn-ticket-main">Add to cart</span>
            <span aria-hidden className="btn-ticket-stub">
              <Plus className="size-[18px]" strokeWidth={2.4} />
            </span>
          </button>
        )}
      </div>
      <p role="status" className="flex min-h-6 items-center gap-3 text-sm">
        {line && (
          <>
            <span className="font-semibold">
              {qty === 1 ? "In your cart" : `${qty} in your cart`}
            </span>
            <button
              type="button"
              onClick={remove}
              className="min-h-11 underline decoration-brand decoration-[1.5px] underline-offset-4"
            >
              Remove
            </button>
          </>
        )}
      </p>
    </div>
  );
}

const backKey = (slug: string) => `back:${slug}`;

/** The store page notes where the buyer is (filters, sort) for the item page's back link. */
export function RememberStore(props: { slug: string; href: string }) {
  useEffect(() => {
    try {
      sessionStorage.setItem(backKey(props.slug), props.href);
    } catch {}
  }, [props.slug, props.href]);
  return null;
}

/**
 * Back to the store as the buyer left it: a history step when they came from
 * it (scroll kept), else a link to the filters they last used.
 */
export function BackToStore({ slug }: { slug: string }) {
  const router = useRouter();
  const saved = useSyncExternalStore(
    noop,
    () => {
      try {
        return sessionStorage.getItem(backKey(slug));
      } catch {
        return null;
      }
    },
    () => null,
  );
  return (
    <Link
      href={saved ?? `/${slug}`}
      onClick={(e) => {
        const from = document.referrer && new URL(document.referrer);
        const cameFromStore =
          window.history.length > 1 &&
          (!from ||
            (from.origin === location.origin && from.pathname === `/${slug}`));
        if (saved && cameFromStore) {
          e.preventDefault();
          router.back();
        }
      }}
      className="flex min-h-11 items-center gap-2 self-start font-semibold lg:col-span-2"
    >
      <ArrowLeft aria-hidden className="size-5" />
      Back to store
    </Link>
  );
}
const noop = () => () => {};

/** The phone's share sheet, or a copied link where there is none. */
export function ShareItem(props: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = location.href.split("?")[0];
    if (navigator.share)
      return navigator.share({ title: props.title, url }).catch(() => {});
    await navigator.clipboard.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };
  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]"
    >
      <Share aria-hidden className="size-4" />
      <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
    </button>
  );
}

/** Paper stub pinned to the bottom once the list has something on it. */
export function ListBar({ slug }: { slug: string }) {
  const lines = useLines(slug);
  // The same tag the seller sees on this list, so they can match it to you.
  const tag = useSyncExternalStore(
    subscribe,
    () => basketTag(deviceId(slug)),
    () => "",
  );
  const n = Object.values(lines).reduce((s, l) => s + l.qty, 0);
  if (!n) return null;
  const total = Object.values(lines).reduce(
    (s, l) => s + (l.price ?? 0) * l.qty,
    0,
  );
  return (
    <div className="fixed inset-x-3 bottom-4 z-20 mx-auto max-w-[560px] drop-shadow-[0_12px_24px_oklch(0_0_0/0.6)]">
      <div className="paper grid grid-cols-[1fr_auto]">
        <p className="px-4 py-2.5" role="status">
          <span className="block text-xs text-muted-foreground">
            Your cart{tag && `, ${tag}. The seller can see it.`}
          </span>
          <span className="font-display num text-[1.625rem] leading-none font-extrabold">
            {n} {n === 1 ? "item" : "items"},{" "}
            {total.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })}
          </span>
        </p>
        <Link
          href={`/${slug}/cart?ids=${Object.keys(lines).join(",")}`}
          className="flex min-h-12 items-center justify-center bg-brand px-5 font-semibold text-on-brand hover:bg-brand-hover"
        >
          Review cart
        </Link>
      </div>
    </div>
  );
}
