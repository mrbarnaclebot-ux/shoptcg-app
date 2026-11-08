/** Rounding steps a store may pick: cents, 50 cents or whole dollars. */
export const ROUNDING_STEPS = [0, 0.5, 1] as const;

/**
 * The price a buyer sees, in USD. A vendor override always wins; otherwise the
 * market price moved by the store rule and rounded to the store step. Null when
 * there is nothing to price from.
 */
export function vendorPrice(
  market: number | null,
  rulePct: number,
  rounding: number,
  override: number | null,
): number | null {
  if (override !== null) return override;
  if (market === null) return null;
  // Work in cents so 0.1 + 0.2 style float error never leaks into a price.
  const cents = Math.round(market * (100 + rulePct));
  const step = Math.round(rounding * 100) || 1;
  const rounded = Math.round(cents / step) * step;
  // A cheap card rounded to a whole-dollar step must not become free.
  return Math.max(rounded, step) / 100;
}
