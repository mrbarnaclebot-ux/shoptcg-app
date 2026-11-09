"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { deliverReceipt } from "@/lib/receipts";
import { saleWithLines } from "@/lib/sales";
import { requireStore } from "@/lib/session";
import { mailForcedToFail } from "../requests/[id]/actions";

/** Sends the receipt again; false when it failed, wasn't theirs or hit the attempt cap. */
export async function resendReceipt(saleId: string) {
  const { store } = await requireStore();
  if (!z.uuid().safeParse(saleId).success) return false;
  const db = getDb();
  if (!(await saleWithLines(db, store.id, saleId))) return false;
  return deliverReceipt(db, saleId, { forceFail: await mailForcedToFail() });
}
