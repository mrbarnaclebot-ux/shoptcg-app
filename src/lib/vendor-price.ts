import type { Condition } from "@/lib/condition";

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
  // Integer cents first: 1.15 * 110 is 126.4999 in floats but 115 * 110 is exact.
  const cents = Math.round((Math.round(market * 100) * (100 + rulePct)) / 100);
  const step = Math.round(rounding * 100) || 1;
  const rounded = Math.round(cents / step) * step;
  // A cheap card rounded to a whole-dollar step must not become free.
  return Math.max(rounded, step) / 100;
}

/** What the add and buy screens price with: the store rule and rounding, and each condition's share of NM. */
export type StorePricing = {
  rulePct: number;
  rounding: number;
  cond: Record<Condition, number>;
};

export const storePricing = (s: {
  priceRulePct: number;
  rounding: string;
  condLpPct: number;
  condMpPct: number;
  condHpPct: number;
  condDmgPct: number;
}): StorePricing => ({
  rulePct: s.priceRulePct,
  rounding: Number(s.rounding),
  cond: {
    NM: 100,
    LP: s.condLpPct,
    MP: s.condMpPct,
    HP: s.condHpPct,
    DMG: s.condDmgPct,
  },
});

/**
 * A Near Mint market moved to a condition's share, to the cent (as
 * conditionMarket in listings.ts), and what the store sells it at.
 * Null when there is no market yet.
 */
export function conditionPrice(
  nm: number | null,
  pct: number,
  p: Pick<StorePricing, "rulePct" | "rounding">,
) {
  if (nm === null) return null;
  const market = Math.round((Math.round(nm * 100) * pct) / 100) / 100;
  return { market, sell: vendorPrice(market, p.rulePct, p.rounding, null)! };
}

// Price on add runs right after the add; a big import takes a few minutes.
const PRICE_WAIT_MS = 10 * 60_000;

/** A catalog card added moments ago whose first market price hasn't landed yet. */
export function awaitingPrice(
  row: {
    catalogItemId: string | null;
    market: number | null;
    overridePrice: number | null;
    createdAt: Date;
  },
  now = Date.now(),
) {
  return (
    row.catalogItemId !== null &&
    row.market === null &&
    row.overridePrice === null &&
    now - row.createdAt.getTime() < PRICE_WAIT_MS
  );
}

/** Whole percent under market for the stamp, or null under 5% (SCREENS 5). Never "above". */
export function underMarket(price: number | null, market: number | null) {
  if (price === null || market === null || market <= 0) return null;
  const pct = Math.floor(((market - price) / market) * 100);
  return pct >= 5 ? pct : null;
}
