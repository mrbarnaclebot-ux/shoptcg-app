import { describe, expect, it } from "vitest";
import { altPrice, formatAlt } from "@/lib/fx";

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
