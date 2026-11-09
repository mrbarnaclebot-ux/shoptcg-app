import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import { customer, receiptEmail, sale, saleLine, store } from "@/db/schema";
import { appUrl } from "@/lib/deployed";
import { sendReceiptEmail } from "@/lib/email";
import { renderReceipt } from "@/lib/receipt-email";
import { saleLines } from "@/lib/sales";

export const MAX_ATTEMPTS = 5;

const lineMeta = (l: typeof saleLine.$inferSelect) =>
  [l.setName, l.number, l.gradeLabel].filter(Boolean).join(" ");

async function compose(db: Db, saleId: string) {
  const [row] = await db
    .select({
      sale,
      storeName: store.name,
      token: customer.unsubscribeToken,
      optedIn: customer.promoOptIn,
    })
    .from(sale)
    .innerJoin(store, eq(store.id, sale.storeId))
    .leftJoin(
      customer,
      and(
        eq(customer.storeId, sale.storeId),
        eq(customer.email, sale.buyerEmail),
      ),
    )
    .where(eq(sale.id, saleId));
  if (!row) return null;
  const lines = await saleLines(db, saleId);
  const unsubscribeUrl = row.optedIn
    ? new URL(`/u/${row.token}`, appUrl()).toString()
    : null;
  return {
    to: row.sale.buyerEmail,
    receiptNo: row.sale.receiptNo,
    unsubscribeUrl,
    message: renderReceipt({
      storeName: row.storeName,
      receiptNo: row.sale.receiptNo,
      buyerName: row.sale.buyerName,
      createdAt: row.sale.createdAt,
      subtotal: row.sale.subtotal,
      discount: row.sale.discount,
      total: row.sale.total,
      method: row.sale.paymentMethod,
      note: row.sale.paymentNote,
      secondCurrency: row.sale.secondCurrency,
      fxRate: row.sale.fxRate,
      lines: lines.map((l) => ({
        name: l.name,
        meta: lineMeta(l),
        imageUrl: l.imageUrl,
        qty: l.qty,
        unitPrice: l.unitPrice,
      })),
      unsubscribeUrl,
    }),
  };
}

/**
 * Sends a sale's receipt and records how it went. Never throws: the sale is
 * already saved, and a failed email is retried from the receipt. False once
 * the attempts are used up or the email failed.
 */
export async function deliverReceipt(
  db: Db,
  saleId: string,
  opts: { forceFail?: boolean } = {},
) {
  const [slot] = await db
    .update(receiptEmail)
    .set({ attempts: sql`${receiptEmail.attempts} + 1`, updatedAt: sql`now()` })
    .where(
      and(
        eq(receiptEmail.saleId, saleId),
        lt(receiptEmail.attempts, MAX_ATTEMPTS),
      ),
    )
    .returning({ saleId: receiptEmail.saleId });
  if (!slot) return false;
  let error: string | null = null;
  try {
    const mail = await compose(db, saleId);
    if (!mail) throw new Error("sale not found");
    if (opts.forceFail) throw new Error("forced failure");
    await sendReceiptEmail(mail);
  } catch (err) {
    error = (err instanceof Error ? err.message : String(err)).slice(0, 200);
    // The sale id only: a provider error can quote the recipient.
    console.error("[receipt] send failed", saleId);
  }
  await db
    .update(receiptEmail)
    .set({
      status: error ? "failed" : "sent",
      lastError: error,
      updatedAt: sql`now()`,
    })
    .where(eq(receiptEmail.saleId, saleId));
  return !error;
}
