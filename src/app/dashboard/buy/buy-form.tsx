"use client";

import { X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Segmented } from "@/components/segmented";
import { lineButton, TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BuyMethod } from "@/db/schema";
import { usd } from "@/lib/format";
import { CONDITIONS } from "@/lib/listing-input";
import { toast } from "@/lib/toast";
import { buyAction } from "./actions";

type Stock = { id: string; name: string; meta: string; qty: number };
type Kind = "raw" | "graded" | "sealed";
type NewItem = {
  name: string;
  kind: Kind;
  language: "en" | "ja" | "zh";
  condition: string;
  grader: string;
  grade: string;
};
type Line = {
  key: string;
  name: string;
  meta: string;
  listingId?: string;
  item?: NewItem;
  qty: string;
  price: string;
};

const METHODS = [
  ["cash", "Cash"],
  ["card", "Card"],
  ["paypal", "PayPal"],
  ["trade", "Trade"],
] as const;

const BLANK: NewItem = {
  name: "",
  kind: "raw",
  language: "en",
  condition: "NM",
  grader: "",
  grade: "",
};

const link =
  "min-h-11 self-start text-sm font-semibold underline decoration-brand decoration-[1.5px] underline-offset-[5px]";

const lineTotal = (l: Line) => {
  const n = Number(l.qty) * Number(l.price.replace("$", ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Pick what you bought from stock or describe a new item, then how you paid. */
export function BuyForm({ stock }: { stock: Stock[] }) {
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [fresh, setFresh] = useState<NewItem | null>(null);
  const [method, setMethod] = useState<BuyMethod>("cash");
  const [seller, setSeller] = useState("");
  const [done, setDone] = useState<string>();
  const [pending, start] = useTransition();
  // One id per buy, kept across retries, so a double tap records it once.
  const buyId = useRef<string | null>(null);

  const picked = new Set(lines.map((l) => l.listingId));
  const needle = q.trim().toLowerCase();
  const hits = needle
    ? stock
        .filter(
          (s) =>
            !picked.has(s.id) &&
            `${s.name} ${s.meta}`.toLowerCase().includes(needle),
        )
        .slice(0, 6)
    : [];
  const total = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const items = lines.reduce((n, l) => n + (Number(l.qty) || 0), 0);

  const add = (l: Omit<Line, "key" | "qty" | "price">) => {
    setDone(undefined);
    setLines((ls) => [
      ...ls,
      { ...l, key: crypto.randomUUID(), qty: "1", price: "" },
    ]);
  };
  const edit = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = () =>
    start(async () => {
      buyId.current ??= crypto.randomUUID();
      const r = await buyAction({
        id: buyId.current,
        method,
        seller,
        lines: lines.map((l) => ({
          qty: l.qty,
          unitPrice: l.price,
          ...(l.listingId
            ? { listingId: l.listingId }
            : {
                item: {
                  name: l.item!.name,
                  kind: l.item!.kind,
                  language: l.item!.language,
                  condition: l.item!.kind === "raw" ? l.item!.condition : null,
                  grader: l.item!.kind === "graded" ? l.item!.grader : null,
                  grade: l.item!.kind === "graded" ? l.item!.grade : null,
                },
              }),
        })),
      }).catch(() => ({
        error: "Couldn't reach the server. Try again.",
        total: undefined,
        items: undefined,
      }));
      if (r.error || !r.total) return void toast.notSaved(r.error ?? "");
      buyId.current = null;
      setLines([]);
      setSeller("");
      setQ("");
      setDone(
        `Bought ${r.items} ${r.items === 1 ? "item" : "items"} for ${usd(Number(r.total))}. They're in stock.`,
      );
    });

  return (
    <div className="flex flex-col gap-6">
      {done && (
        <p role="status" className="font-semibold">
          {done}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="buy-search">Find it in your stock</Label>
        <Input
          id="buy-search"
          type="search"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name or number"
        />
        {needle && (
          <ul className="border-b border-border">
            {hits.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 border-t border-border py-2"
              >
                <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                  {s.name}
                  <small className="block text-sm font-normal text-muted-foreground">
                    {s.meta ? `${s.meta}. ` : ""}
                    {s.qty} in stock.
                  </small>
                </span>
                <button
                  type="button"
                  // The same card can be two listings (NM and LP).
                  aria-label={`Add ${s.name}${s.meta ? `, ${s.meta}` : ""}`}
                  onClick={() => {
                    add({ listingId: s.id, name: s.name, meta: s.meta });
                    setQ("");
                  }}
                  className={lineButton}
                >
                  Add
                </button>
              </li>
            ))}
            {hits.length === 0 && (
              <li className="border-t border-border py-2 text-sm text-muted-foreground">
                Not in your stock. Add it as a new item.
              </li>
            )}
          </ul>
        )}
        {!fresh && (
          <button
            type="button"
            onClick={() => setFresh(BLANK)}
            className={link}
          >
            New item
          </button>
        )}
      </div>

      {fresh && (
        <NewItemFields
          value={fresh}
          onChange={setFresh}
          onCancel={() => setFresh(null)}
          onAdd={() => {
            add({ item: fresh, name: fresh.name.trim(), meta: "New item" });
            setFresh(null);
          }}
        />
      )}

      {lines.length > 0 && (
        <ul aria-label="Bought" className="border-b border-border">
          {lines.map((l) => (
            <li
              key={l.key}
              className="flex flex-col gap-3 border-t border-border py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                  {l.name}
                  <small className="block text-sm font-normal text-muted-foreground">
                    {l.meta}
                  </small>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${l.name}`}
                  onClick={() =>
                    setLines((ls) => ls.filter((x) => x.key !== l.key))
                  }
                  className="inline-flex size-11 shrink-0 items-center justify-center text-muted-foreground hover:text-text"
                >
                  <X aria-hidden className="size-5" />
                </button>
              </div>
              <div className="grid grid-cols-[5rem_1fr] gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`qty-${l.key}`}>
                    Qty<span className="sr-only">, {l.name}</span>
                  </Label>
                  <Input
                    id={`qty-${l.key}`}
                    inputMode="numeric"
                    value={l.qty}
                    onChange={(e) => edit(l.key, { qty: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`price-${l.key}`}>
                    Paid each<span className="sr-only">, {l.name}</span>
                  </Label>
                  <Input
                    id={`price-${l.key}`}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00"
                    value={l.price}
                    onChange={(e) => edit(l.key, { price: e.target.value })}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {lines.length > 0 && (
        <>
          <Segmented
            label="Paid with"
            value={method}
            onChange={setMethod}
            options={METHODS}
          />
          {method === "trade" && (
            <p className="-mt-3 text-sm text-muted-foreground">
              Store credit against a sale. No cash leaves the box.
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="buy-seller">Seller (optional)</Label>
            <Input
              id="buy-seller"
              maxLength={40}
              autoComplete="off"
              value={seller}
              onChange={(e) => setSeller(e.target.value)}
              placeholder="First name or a note"
            />
          </div>
          <TicketButton
            onClick={submit}
            disabled={pending}
            aria-busy={pending}
            className="w-full"
          >
            {pending
              ? "Saving"
              : `Record buy, ${items} ${items === 1 ? "item" : "items"}, ${usd(total)}`}
          </TicketButton>
        </>
      )}
    </div>
  );
}

function NewItemFields(props: {
  value: NewItem;
  onChange: (v: NewItem) => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  const v = props.value;
  const set = (patch: Partial<NewItem>) => props.onChange({ ...v, ...patch });
  return (
    <fieldset className="flex flex-col gap-4 border-t border-dashed border-border-strong pt-4">
      <legend className="sr-only">New item</legend>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-name">Name</Label>
        <Input
          id="new-name"
          autoFocus
          autoComplete="off"
          maxLength={120}
          value={v.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Pikachu promo"
        />
      </div>
      <Segmented
        name="new-kind"
        label="Type"
        value={v.kind}
        onChange={(kind) => set({ kind })}
        options={[
          ["raw", "Raw"],
          ["graded", "Graded"],
          ["sealed", "Sealed"],
        ]}
      />
      <Segmented
        name="new-language"
        label="Language"
        value={v.language}
        onChange={(language) => set({ language })}
        options={[
          ["en", "English"],
          ["ja", "Japanese"],
          ["zh", "Chinese"],
        ]}
      />
      {v.kind === "raw" && (
        <Segmented
          name="new-condition"
          label="Condition"
          value={v.condition}
          onChange={(condition) => set({ condition })}
          options={CONDITIONS.map((c) => [c, c] as const)}
        />
      )}
      {v.kind === "graded" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-grader">Grader</Label>
            <Input
              id="new-grader"
              maxLength={20}
              value={v.grader}
              onChange={(e) => set({ grader: e.target.value })}
              placeholder="PSA, ACE, TAG"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-grade">Grade</Label>
            <Input
              id="new-grade"
              maxLength={10}
              value={v.grade}
              onChange={(e) => set({ grade: e.target.value })}
              placeholder="10"
            />
          </div>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        It goes in as a custom item with no market price. Set a price in
        Inventory before you sell it.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!v.name.trim()}
          onClick={props.onAdd}
          className={lineButton}
        >
          Add to buy
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          className="min-h-11 text-sm text-muted-foreground underline underline-offset-4"
        >
          Cancel
        </button>
      </div>
    </fieldset>
  );
}
