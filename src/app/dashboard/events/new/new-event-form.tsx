"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Segmented } from "@/components/segmented";
import { TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usd } from "@/lib/format";
import { createEventAction } from "../actions";

type Stock = {
  id: string;
  name: string;
  meta: string;
  qty: number;
  price: number | null;
};
type Picked = { price: string; max: string };

const LENGTHS = [
  [15, "15 min"],
  [30, "30 min"],
  [60, "1 hour"],
  [120, "2 hours"],
  [360, "6 hours"],
  [720, "12 hours"],
  [1440, "1 day"],
  [4320, "3 days"],
  [10080, "7 days"],
] as const;

const noop = () => () => {};

type Field = "title" | "starts" | "max" | "pay" | "items";
// Top to bottom, so focus goes to the first field that needs a fix.
const ORDER: Field[] = ["title", "starts", "max", "pay", "items"];
const FOCUS: Record<Field, string> = {
  title: "title",
  starts: "starts",
  max: "max",
  pay: "pay",
  items: "find",
};

const whole = (v: string, min: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** Name, when and how long, the rules, then which stock goes in. */
export function NewEventForm({ stock }: { stock: Stock[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<Partial<Record<Field, string>>>({});
  // The browser's zone and clock: known only once the page is running.
  const zone = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [startsAt, setStartsAt] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [priceMode, setPriceMode] = useState<"market" | "custom">("market");
  const [allowUnclaim, setAllowUnclaim] = useState(true);
  const [maxPerBuyer, setMaxPerBuyer] = useState("5");
  const [payWithin, setPayWithin] = useState("24");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, Picked>>({});

  const shown = stock.filter((s) =>
    `${s.name} ${s.meta}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const count = Object.keys(picked).length;

  const toggle = (s: Stock) =>
    setPicked((p) => {
      const next = { ...p };
      if (next[s.id]) delete next[s.id];
      else next[s.id] = { price: s.price?.toFixed(2) ?? "", max: "1" };
      return next;
    });
  const edit = (id: string, patch: Partial<Picked>) =>
    setPicked((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  const startTime =
    when === "now" ? new Date() : startsAt ? new Date(startsAt) : null;
  const ends =
    startTime && !Number.isNaN(+startTime)
      ? new Date(+startTime + Number(minutes) * 60_000)
      : null;

  const fail = (found: Partial<Record<Field, string>>) => {
    setErrs(found);
    const first = ORDER.find((f) => found[f]);
    if (first) document.getElementById(FOCUS[first])?.focus();
  };

  const submit = () =>
    start(async () => {
      setError(null);
      const start =
        when === "now" ? new Date() : startsAt ? new Date(startsAt) : null;
      const found: Partial<Record<Field, string>> = {};
      if (!title.trim()) found.title = "Give the event a name.";
      if (!start || Number.isNaN(+start)) found.starts = "Pick when it starts.";
      const max = whole(maxPerBuyer, 1, 99);
      const pay = whole(payWithin, 1, 168);
      if (max === null) found.max = "A whole number from 1 to 99.";
      if (pay === null) found.pay = "A whole number of hours, 1 to 168.";
      const items = [];
      for (const [listingId, p] of Object.entries(picked)) {
        const each = whole(p.max, 1, 99);
        if (each === null)
          found.items = "Each per-item limit is a whole number from 1 to 99.";
        items.push({
          listingId,
          price: priceMode === "custom" ? p.price.replace("$", "") : null,
          maxPerBuyer: each ?? 1,
        });
      }
      if (!start || max === null || pay === null || Object.keys(found).length)
        return fail(found);
      setErrs({});
      const res = await createEventAction({
        title,
        startsAt: start.toISOString(),
        endsAt: new Date(+start + Number(minutes) * 60_000).toISOString(),
        priceMode,
        allowUnclaim,
        payWithinHours: pay,
        maxPerBuyer: max,
        items,
      }).catch(() => null);
      if (!res) return setError("Couldn't save that. Check your connection.");
      if ("error" in res) return setError(res.error);
      router.push(`/dashboard/events/${res.id}`);
    });

  // A field's invalid state and its own error line.
  const err = (f: Field) => ({
    "aria-invalid": errs[f] ? true : undefined,
    "aria-describedby": `${f}-error`,
  });
  const fieldError = (f: Field) =>
    errs[f] ? (
      <p id={`${f}-error`} className="text-sm font-semibold text-danger">
        {errs[f]}
      </p>
    ) : null;

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Name</Label>
        <Input
          id="title"
          value={title}
          maxLength={80}
          placeholder="e.g. Friday night drop"
          onChange={(e) => setTitle(e.target.value)}
          {...err("title")}
        />
        {fieldError("title")}
      </div>
      <Segmented
        label="Starts"
        value={when}
        options={[
          ["now", "Now"],
          ["later", "Later"],
        ]}
        onChange={setWhen}
      />
      {when === "later" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="starts">Start time</Label>
          <Input
            id="starts"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            {...err("starts")}
          />
          {fieldError("starts")}
          <p className="text-sm text-muted-foreground">
            Buyers can join before it starts, so share the link early.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="length">Runs for</Label>
        <select
          id="length"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="min-h-12 bg-surface px-3 shadow-[inset_0_0_0_1px_var(--border-strong)]"
        >
          {LENGTHS.map(([m, label]) => (
            <option key={m} value={m}>
              {label}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {zone && ends && (
            <>
              Ends{" "}
              <span className="num font-semibold text-text">
                {ends.toLocaleString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              , {zone.replaceAll("_", " ")} time.{" "}
            </>
          )}
          Or sooner: it ends early once everything is claimed.
        </p>
      </div>
      <Segmented
        label="Prices"
        value={priceMode}
        options={[
          ["market", "My store prices"],
          ["custom", "Set my own"],
        ]}
        onChange={setPriceMode}
      />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="max">Items per buyer</Label>
          <Input
            id="max"
            inputMode="numeric"
            value={maxPerBuyer}
            onChange={(e) => setMaxPerBuyer(e.target.value)}
            {...err("max")}
          />
          {fieldError("max")}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pay">Hours to pay after</Label>
          <Input
            id="pay"
            inputMode="numeric"
            value={payWithin}
            onChange={(e) => setPayWithin(e.target.value)}
            {...err("pay")}
          />
          {fieldError("pay")}
        </div>
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">
        The most one buyer can claim, so nobody takes everything. Claims not
        paid in time go back to your store.
      </p>
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          checked={allowUnclaim}
          onChange={(e) => setAllowUnclaim(e.target.checked)}
          className="mt-0.5 size-6 shrink-0 accent-brand"
        />
        <span>
          Buyers can give a claim back until the end
          <span className="block text-sm text-muted-foreground">
            The item goes straight back into the event.
          </span>
        </span>
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lg font-semibold">
          Items <span className="num text-muted-foreground">({count})</span>
        </legend>
        <p className="text-sm text-muted-foreground">
          Picked items leave your store page until the event ends. Whatever
          isn&apos;t claimed comes back after.
        </p>
        <Input
          id="find"
          aria-label="Find in stock"
          placeholder="Find in stock"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {!stock.length && (
          <p className="font-semibold">
            Nothing in stock to add. Add stock first.
          </p>
        )}
        {fieldError("items")}
        {/* One scroll: the page's, not a box inside it. */}
        <ul>
          {shown.map((s) => {
            const p = picked[s.id];
            return (
              <li key={s.id} className="border-b border-border py-3">
                <label className="flex min-h-11 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={Boolean(p)}
                    onChange={() => toggle(s)}
                    className="mt-0.5 size-6 shrink-0 accent-brand"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{s.name}</span>
                    <span className="num block text-sm text-muted-foreground">
                      {s.meta} · {s.qty} in stock ·{" "}
                      {s.price === null ? "no price yet" : usd(s.price)}
                    </span>
                  </span>
                </label>
                {p && (
                  <div className="mt-2 ml-9 grid grid-cols-2 gap-3">
                    {priceMode === "custom" && (
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`price-${s.id}`}>Event price</Label>
                        <Input
                          id={`price-${s.id}`}
                          inputMode="decimal"
                          value={p.price}
                          placeholder="e.g. 12.00"
                          onChange={(e) =>
                            edit(s.id, { price: e.target.value })
                          }
                        />
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`max-${s.id}`}>Most per buyer</Label>
                      <Input
                        id={`max-${s.id}`}
                        inputMode="numeric"
                        value={p.max}
                        onChange={(e) => edit(s.id, { max: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>

      {error && (
        <p role="alert" className="font-semibold text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-col items-start gap-2">
        <TicketButton
          type="submit"
          disabled={pending || !count}
          aria-busy={pending}
          aria-describedby="create-why"
        >
          {pending
            ? "Saving"
            : when === "now"
              ? "Start event"
              : "Schedule event"}
        </TicketButton>
        {!count && (
          <p id="create-why" className="text-sm text-muted-foreground">
            Pick at least one item above to start.
          </p>
        )}
      </div>
    </form>
  );
}
