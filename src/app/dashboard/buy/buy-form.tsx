"use client";

import { X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { chip, Segmented } from "@/components/segmented";
import { lineButton, TicketButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BuyMethod } from "@/db/schema";
import { StockSearch } from "../stock-search";
import type { SearchItem } from "@/lib/catalog";
import { usd } from "@/lib/format";
import { CONDITIONS, type Condition } from "@/lib/condition";
import { fromCents, toCents } from "@/lib/money";
import type { Grader } from "@/lib/pricing/provider";
import { toast } from "@/lib/toast";
import { conditionPrice, type StorePricing } from "@/lib/vendor-price";
import { MarketLine, SlabFields } from "../inventory/add/add-panel";
import {
  CatalogSearch,
  savedCondition,
  savePrefs,
} from "../inventory/add/catalog-search";
import { buyAction, findBuyStockAction } from "./actions";

type Kind = "raw" | "graded" | "sealed" | "other";
type NewItem = {
  name: string;
  kind: Kind;
  language: "en" | "ja" | "zh";
  condition: string;
  grader: string;
  grade: string;
};
/** A card picked from the catalog search, with what the vendor says it is. */
type Card = {
  item: SearchItem;
  graded: boolean;
  condition: Condition;
  grader: Grader;
  grade: string;
};
type Line = {
  key: string;
  name: string;
  meta: string;
  listingId?: string;
  item?: NewItem;
  card?: Card;
  qty: string;
  price: string;
};

const OFFERS = [60, 70, 80];

/** The market a catalog line is bought against: its condition's share of NM; none for a slab yet. */
function cardMarket(c: Card, pricing: StorePricing) {
  const raw = c.item.kind === "raw" && !c.graded;
  return conditionPrice(
    c.graded || c.item.market === null ? null : Number(c.item.market),
    raw ? pricing.cond[c.condition] : 100,
    pricing,
  )?.market;
}

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
export function BuyForm({ pricing }: { pricing: StorePricing }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [fresh, setFresh] = useState<NewItem | null>(null);
  const [method, setMethod] = useState<BuyMethod>("cash");
  const [seller, setSeller] = useState("");
  const [done, setDone] = useState<string>();
  const [pending, start] = useTransition();
  // One id per buy, kept across retries, so a double tap records it once.
  const buyId = useRef<string | null>(null);

  const picked = new Set(lines.flatMap((l) => l.listingId ?? []));
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
          ...(l.card
            ? {
                catalogItemId: l.card.item.id,
                condition:
                  l.card.item.kind === "raw" && !l.card.graded
                    ? l.card.condition
                    : null,
                grader: l.card.graded ? l.card.grader : null,
                grade: l.card.graded ? l.card.grade : null,
              }
            : l.listingId
              ? { listingId: l.listingId }
              : {
                  item: {
                    name: l.item!.name,
                    kind: l.item!.kind,
                    language:
                      l.item!.kind === "other" ? "en" : l.item!.language,
                    condition:
                      l.item!.kind === "raw" ? l.item!.condition : null,
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

      {/* The catalog has the market price; a card already in stock is topped up. */}
      <section aria-label="Catalog" className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Search the catalog</p>
        <CatalogSearch
          pricing={pricing}
          onPick={(item, graded) =>
            add({
              name: item.name,
              meta: [item.setName, item.number && `#${item.number}`]
                .filter(Boolean)
                .join(" · "),
              card: {
                item,
                graded,
                condition: savedCondition(),
                grader: "PSA",
                grade: "10",
              },
            })
          }
        />
      </section>

      <div className="flex flex-col gap-2">
        <StockSearch
          id="buy-search"
          label="Or find it in your stock"
          search={findBuyStockAction}
          skip={picked}
          empty="Not in your stock. Add it as a new item."
          onPick={(s) => add({ listingId: s.id, name: s.name, meta: s.meta })}
        />
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
              {l.card && (
                <CardFields
                  lineKey={l.key}
                  card={l.card}
                  pricing={pricing}
                  price={l.price}
                  onChange={(card) => edit(l.key, { card })}
                  onOffer={(price) => edit(l.key, { price })}
                />
              )}
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

/** Condition or grade, the market for it, and offer chips that fill Paid each. */
function CardFields(props: {
  lineKey: string;
  card: Card;
  pricing: StorePricing;
  price: string;
  onChange: (c: Card) => void;
  onOffer: (price: string) => void;
}) {
  const { card: c } = props;
  const set = (patch: Partial<Card>) => props.onChange({ ...c, ...patch });
  const market = cardMarket(c, props.pricing);
  return (
    <div className="flex flex-col gap-3">
      {c.graded ? (
        <SlabFields
          id={`grade-${props.lineKey}`}
          grader={c.grader}
          onGrader={(grader) => set({ grader })}
          grade={c.grade}
          onGrade={(grade) => set({ grade })}
        />
      ) : (
        c.item.kind === "raw" && (
          <Segmented
            label="Condition"
            name={`condition-${props.lineKey}`}
            value={c.condition}
            options={CONDITIONS.map((x) => [x, x] as const)}
            onChange={(condition) => {
              set({ condition });
              savePrefs({ condition });
            }}
          />
        )
      )}
      <MarketLine
        item={c.item}
        condition={c.condition}
        graded={c.graded}
        pricing={props.pricing}
        sell={false}
      />
      {market != null && (
        <div role="group" aria-label="Offer" className="flex flex-wrap gap-2">
          {OFFERS.map((pct) => {
            const offer = fromCents(Math.round((toCents(market) * pct) / 100));
            return (
              <button
                key={pct}
                type="button"
                aria-label={`Offer ${pct}%`}
                aria-pressed={props.price === offer}
                onClick={() => props.onOffer(offer)}
                className={chip}
              >
                {pct}%
              </button>
            );
          })}
        </div>
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
          ["other", "Other"],
        ]}
      />
      {v.kind !== "other" && (
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
      )}
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
