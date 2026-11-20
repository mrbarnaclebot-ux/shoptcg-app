"use client";

import { useRef, useState } from "react";
import { lineButton } from "@/components/ticket-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type StockHit = { id: string; name: string; meta: string; note: string };

/**
 * Finds the store's own listings on the server as the vendor types, so a big
 * store finds any item. Used by Buy and by the sale screen's Add item.
 */
export function StockSearch(props: {
  id: string;
  label: string;
  search: (q: string) => Promise<StockHit[]>;
  onPick: (hit: StockHit) => void;
  /** Already picked; left out of the results. */
  skip?: Set<string>;
  empty: string;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  // undefined while looking, null when the lookup failed.
  const [hits, setHits] = useState<StockHit[] | null>();
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const look = (v: string) => {
    setQ(v);
    clearTimeout(timer.current);
    // A slow answer for an older query must not replace a newer one.
    const n = ++seq.current;
    setHits(undefined);
    if (!v.trim()) return;
    timer.current = setTimeout(async () => {
      const found = await props.search(v.trim()).catch(() => null);
      if (n === seq.current) setHits(found);
    }, 200);
  };
  const shown = hits?.filter((h) => !props.skip?.has(h.id)) ?? [];
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input
        id={props.id}
        type="search"
        autoComplete="off"
        value={q}
        onChange={(e) => look(e.target.value)}
        placeholder="Name or number"
      />
      {q.trim() && (
        <ul className="border-b border-border" aria-busy={hits === undefined}>
          {shown.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between gap-3 border-t border-border py-2"
            >
              <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                {h.name}
                <small className="block text-sm font-normal text-muted-foreground">
                  {h.meta ? `${h.meta}. ` : ""}
                  {h.note}
                </small>
              </span>
              <button
                type="button"
                disabled={props.disabled}
                // The same card can be two listings (NM and LP).
                aria-label={`Add ${h.name}${h.meta ? `, ${h.meta}` : ""}`}
                onClick={() => {
                  props.onPick(h);
                  look("");
                }}
                className={lineButton}
              >
                Add
              </button>
            </li>
          ))}
          {hits !== undefined && !shown.length && (
            <li
              role="status"
              className="border-t border-border py-2 text-sm text-muted-foreground"
            >
              {hits === null
                ? "Couldn't search your stock. Try again."
                : props.empty}
            </li>
          )}
          {hits === undefined && (
            <li
              role="status"
              className="border-t border-border py-2 text-sm text-muted-foreground"
            >
              Looking...
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
