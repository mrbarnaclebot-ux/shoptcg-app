/** The buyer's second currency at the vendor's own rate; null without one. */
export function altPrice(usd: number | null, rate: number | null) {
  if (usd === null || rate === null || !(rate > 0)) return null;
  return usd * rate;
}

/** "A$64": whole units, because the line already says "approx.". */
export function formatAlt(code: string, n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(n);
}
