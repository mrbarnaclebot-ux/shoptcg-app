"use client";

import { Check, Plus } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

// The buyer's list lives on this phone only, per store, for 24 hours
// (SCREENS 7). It is the one client island on the public pages.

// The name is only for a row whose item has since gone; older lists lack it.
export type Line = { qty: number; price: number | null; name?: string };
type List = { at: number; lines: Record<string, Line> };

const TTL_MS = 24 * 60 * 60 * 1000;
const EVENT = "shoptcg:list";
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

/**
 * Add toggle: a 44px square on tiles, or the full-width ticket on the item
 * page. Pressed, it turns lamp orange with a check.
 */
export function AddButton(props: {
  slug: string;
  id: string;
  name: string;
  price: number | null;
  big?: boolean;
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
  if (props.big)
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        className="btn-ticket w-full"
      >
        <span className="btn-ticket-main">
          {on ? "On your list" : "Add to list"}
        </span>
        <span aria-hidden className="btn-ticket-stub">
          <Icon className="size-[18px]" strokeWidth={2.4} />
        </span>
      </button>
    );
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={`Add ${props.name} to your list`}
      className={`grid size-11 shrink-0 place-items-center ${on ? "bg-brand text-on-brand" : "bg-surface text-text shadow-[inset_0_0_0_1px_var(--border-strong)]"}`}
    >
      <Icon aria-hidden className="size-5" strokeWidth={2.3} />
    </button>
  );
}

/** Paper stub pinned to the bottom once the list has something on it. */
export function ListBar({ slug }: { slug: string }) {
  const lines = useLines(slug);
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
          <span className="block text-xs text-muted-foreground">Your list</span>
          <span className="font-display num text-[1.625rem] leading-none font-extrabold">
            {n} {n === 1 ? "item" : "items"},{" "}
            {total.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })}
          </span>
        </p>
        <Link
          href={`/${slug}/list?ids=${Object.keys(lines).join(",")}`}
          className="flex min-h-12 items-center justify-center bg-brand px-5 font-semibold text-on-brand hover:bg-brand-hover"
        >
          Review list
        </Link>
      </div>
    </div>
  );
}
