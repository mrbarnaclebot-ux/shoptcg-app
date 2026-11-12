"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db";
import { buyInput, recordBuy } from "@/lib/buys";
import { ListingError } from "@/lib/listings";
import { requireStore } from "@/lib/session";

export type BuyState = { error?: string; total?: string; items?: number };

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
