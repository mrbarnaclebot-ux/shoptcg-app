"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { VOID_REASON_MAX } from "@/db/schema";
import { mailForcedToFail } from "@/lib/mail-forced";
import { deliverReceipt } from "@/lib/receipts";
import { saleWithLines, voidSale } from "@/lib/sales";
import { requireStore } from "@/lib/session";

/** Sends the receipt again; false when it failed, wasn't theirs or hit the attempt cap. */
export async function resendReceipt(saleId: string) {
  const { store } = await requireStore();
  if (!z.uuid().safeParse(saleId).success) return false;
  const db = getDb();
  const sale = await saleWithLines(db, store.id, saleId);
  if (!sale || sale.void) return false;
  return deliverReceipt(db, saleId, { forceFail: await mailForcedToFail() });
}

const voidInput = z.object({
  saleId: z.uuid(),
  restock: z.boolean(),
  reason: z.string().trim().max(VOID_REASON_MAX).optional(),
});

/** Voids one of this store's sales; false when it isn't theirs or the input is bad. */
export async function voidSaleAction(input: z.input<typeof voidInput>) {
  const { store } = await requireStore();
  const v = voidInput.safeParse(input);
  if (!v.success) return false;
  const r = await voidSale(getDb(), store.id, v.data.saleId, v.data);
  return "ok" in r;
}
