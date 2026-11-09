// Sale maths in integer cents. Pure, so the confirm screen shows the same total
// the server records.

export const toCents = (v: string | number) => Math.round(Number(v) * 100);
export const fromCents = (c: number) => (c / 100).toFixed(2);

export const PRICE_RE = /^\d{1,5}(\.\d{1,2})?$/;

export type Discount = {
  kind: "none" | "amount" | "percent";
  value?: string;
};

export type PricedSale = {
  subtotal: number;
  discount: number;
  total: number;
  /** Percent in hundredths, as entered; null unless the discount was a percent. */
  pct: number | null;
};

/** Totals in cents, or null for a price or discount the sale can't carry. */
export function priceSale(
  lines: { qty: number; unitPrice: string }[],
  d: Discount,
): PricedSale | null {
  if (lines.some((l) => !PRICE_RE.test(l.unitPrice))) return null;
  const subtotal = lines.reduce((s, l) => s + toCents(l.unitPrice) * l.qty, 0);
  if (d.kind === "none")
    return { subtotal, discount: 0, total: subtotal, pct: null };
  if (!d.value || !PRICE_RE.test(d.value)) return null;
  const pct = d.kind === "percent" ? toCents(d.value) : null;
  if (pct !== null && pct > 10_000) return null;
  // Half up to the cent: subtotal cents x hundredths of a percent / 10000.
  const discount =
    pct !== null ? Math.round((subtotal * pct) / 10_000) : toCents(d.value);
  if (discount > subtotal) return null;
  return { subtotal, discount, total: subtotal - discount, pct };
}
