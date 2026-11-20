"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { getDb } from "@/db";
import type { StockHit } from "@/app/dashboard/stock-search";
import { buyInput, recordBuy } from "@/lib/buys";
import { stockMeta } from "@/lib/format";
import { ListingError, listStock } from "@/lib/listings";
import { requireStore } from "@/lib/session";
import { priceNewListings } from "@/lib/sync-prices";

export type BuyState = { error?: string; total?: string; items?: number };

/** Listings matching the words, hidden ones too (a buy can restock them), for the picker. */
export async function findBuyStockAction(q: string): Promise<StockHit[]> {
  const { store } = await requireStore();
  const words = String(q).trim().slice(0, 80);
  if (!words) return [];
  const db = getDb();
  const rows = [
    ...(await listStock(db, store.id, { q: words, limit: 6 })),
    ...(await listStock(db, store.id, { q: words, kind: "hidden", limit: 6 })),
  ];
  return rows.slice(0, 8).map((r) => ({
    id: r.id,
    name: r.name,
    meta: stockMeta(r),
    note: `${r.qty} in stock.`,
  }));
}

/** Records a buy for the signed-in vendor's store; the store id never comes from the browser. */
export async function buyAction(input: unknown): Promise<BuyState> {
  const { store } = await requireStore();
  const v = buyInput.safeParse(input);
  if (!v.success) return { error: v.error.issues[0].message };
  try {
    const r = await recordBuy(getDb(), store.id, v.data);
    if ("gone" in r)
      return { error: "An item left your stock. Reload and try again." };
    if ("full" in r) return { error: "That would pass 9999 of one item." };
    // A card new to the store gets its price and history, as an add does.
    const db = getDb();
    if (r.added?.length) after(() => priceNewListings(db, r.added!));
    refresh();
    return {
      total: r.total,
      items: v.data.lines.reduce((n, l) => n + l.qty, 0),
    };
  } catch (err) {
    if (err instanceof ListingError) return { error: err.message };
    console.error("[buy] record failed", err);
    return { error: "Couldn't save that. Try again." };
  }
}
