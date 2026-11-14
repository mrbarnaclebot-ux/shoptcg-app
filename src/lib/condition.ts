// A played raw card is worth a share of the Near Mint market. Providers price
// Near Mint reliably and played copies noisily (MP above NM is common), so the
// store sets the shares (Pricing settings) and every price follows from NM.
// The SQL that applies them is conditionMarket in src/lib/listings.ts.
// Plain constants: the settings form imports this on the client.

export const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"] as const;
export type Condition = (typeof CONDITIONS)[number];

// Slabs carry a grade instead.
export const GRADERS = ["PSA", "BGS", "CGC", "SGC"] as const;
// 10, 9.5, 9 ... 1, as the catalog_item_grade check allows.
export const GRADES = Array.from({ length: 19 }, (_, i) => String(10 - i / 2));

export const CONDITION_NAME: Record<string, string> = {
  NM: "Near Mint",
  LP: "Lightly Played",
  MP: "Moderately Played",
  HP: "Heavily Played",
  DMG: "Damaged",
};

/** Each played condition's settings column, in the order the form shows them. */
export const CONDITION_FIELDS = [
  ["LP", "condLpPct"],
  ["MP", "condMpPct"],
  ["HP", "condHpPct"],
  ["DMG", "condDmgPct"],
] as const;

export type ConditionPcts = Record<
  (typeof CONDITION_FIELDS)[number][1],
  number
>;
