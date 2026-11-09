"use server";

import { cookies } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { PAYMENT_METHODS } from "@/db/schema";
import { getDb } from "@/db";
import { seedAllowed } from "@/lib/e2e-seed";
import { MAX_LINES } from "@/lib/requests";
import { deliverReceipt } from "@/lib/receipts";
import { PRICE_RE } from "@/lib/money";
import { confirmSale, type ConfirmResult } from "@/lib/sales";
import { requireStore } from "@/lib/session";

const schema = z
  .object({
    requestId: z.uuid(),
    lines: z
      .array(
        z.object({
          listingId: z.uuid(),
          qty: z.number().int().min(1).max(99),
          unitPrice: z.string().regex(PRICE_RE),
        }),
      )
      .min(1)
      .max(MAX_LINES),
    discount: z.object({
      kind: z.enum(["none", "amount", "percent"]),
      value: z.string().regex(PRICE_RE).optional(),
    }),
    method: z.enum(PAYMENT_METHODS),
    note: z.string().trim().min(1).max(40).optional(),
  })
  .refine((v) => v.method !== "other" || v.note, { path: ["note"] });

/** e2e only: a cookie makes the send fail. Never honoured on a deployed service. */
export async function mailForcedToFail() {
  if (!seedAllowed(process.env)) return false;
  return (await cookies()).has("e2e_mail_fail");
}

/** Totals are recomputed on the server; the client's only choose. */
export async function confirmSaleAction(
  input: unknown,
): Promise<ConfirmResult> {
  const { store } = await requireStore();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { invalid: true };
  const db = getDb();
  let result: ConfirmResult;
  try {
    result = await confirmSale(db, store.id, parsed.data);
  } catch (err) {
    // A failed query's message carries its params: the buyer's name and email.
    const code = (err as { cause?: { code?: string } }).cause?.code;
    console.error("[sale] confirm failed", parsed.data.requestId, code);
    throw new Error("Sale not saved");
  }
  if ("ok" in result && !result.retry) {
    const { saleId } = result;
    const forceFail = await mailForcedToFail();
    after(() => deliverReceipt(db, saleId, { forceFail }));
  }
  return result;
}
