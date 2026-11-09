"use server";

import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { pushNewRequest } from "@/lib/push";
import { createRequest, declineRequest, HOLD_MS } from "@/lib/requests";
import { requireStore } from "@/lib/session";
import { getPublicStore, listPublicStock } from "@/lib/storefront";

/** False when the request is not this store's or already settled. */
export async function declineAction(id: string) {
  const { store } = await requireStore();
  if (!z.uuid().safeParse(id).success) return false;
  return declineRequest(getDb(), store.id, id);
}

/** A rehearsal: holds up to two of the vendor's own items like a real buyer would. */
export async function sendTestRequest() {
  const { store } = await requireStore();
  const db = getDb();
  const pub = (await getPublicStore(db, store.slug))!;
  const stock = await listPublicStock(db, pub);
  const pick = stock.filter((s) => s.available > 0 && s.price !== null);
  if (!pick.length) return { empty: true as const };
  const r = await createRequest(db, {
    storeId: store.id,
    lines: pick.slice(0, 2).map((s) => ({ listingId: s.id, qty: 1 })),
    buyerName: "Test buyer",
    buyerEmail: null,
    promo: false,
    sessionId: `test:${store.id}`,
    ipHash: null,
    holdMs: HOLD_MS,
    isTest: true,
  });
  if (!r.ok) return { empty: true as const };
  after(() => pushNewRequest(db, store.id, { ...r, name: "Test buyer" }));
  return { ok: true as const };
}
