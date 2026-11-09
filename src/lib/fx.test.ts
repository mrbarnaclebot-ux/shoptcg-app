import { describe, expect, it } from "vitest";
import { altPrice, formatAlt, usdTag } from "@/lib/fx";

describe("fx", () => {
  it("converts at the vendor rate and needs both values", () => {
    expect(altPrice(42, 1.52)).toBeCloseTo(63.84);
    expect(altPrice(null, 1.52)).toBeNull();
    expect(altPrice(42, null)).toBeNull();
    expect(altPrice(42, 0)).toBeNull();
  });

  it("formats whole units", () => {
    expect(formatAlt("AUD", 63.84)).toBe("A$64");
    expect(formatAlt("JPY", 6384.4)).toBe("¥6,384");
  });
});

describe("usdTag", () => {
  it("drops zero cents only", () => {
    expect(usdTag(42)).toBe("$42");
    expect(usdTag(18.5)).toBe("$18.50");
    expect(usdTag(1310.25)).toBe("$1,310.25");
  });
});
