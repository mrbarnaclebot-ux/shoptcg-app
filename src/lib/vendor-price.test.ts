import { describe, expect, it } from "vitest";
import { underMarket, vendorPrice } from "@/lib/vendor-price";

describe("vendorPrice", () => {
  it.each([
    // market, pct, rounding, override, want
    [48.1, 0, 0, null, 48.1],
    [48.1, -10, 0, null, 43.29],
    [48.1, -10, 0.5, null, 43.5],
    [48.1, -10, 1, null, 43],
    [1302.4, -5, 1, null, 1237],
    [0.1, 0, 0.5, null, 0.5],
    [0.2, -10, 1, null, 1],
    [10, 15, 0, null, 11.5],
    [1.15, 10, 0, null, 1.27],
    [0.07, 0, 0, null, 0.07],
    [48.1, -10, 1, 39.99, 39.99],
    [null, -10, 1, 12.5, 12.5],
    [null, 0, 0, null, null],
  ])("market %s pct %s step %s override %s -> %s", (m, pct, r, o, want) =>
    expect(vendorPrice(m, pct, r, o)).toBe(want),
  );

  it("rounds half-way values up to the step", () => {
    expect(vendorPrice(42.25, 0, 0.5, null)).toBe(42.5);
    expect(vendorPrice(42.5, 0, 1, null)).toBe(43);
  });
});

describe("underMarket", () => {
  it.each([
    [42, 48.1, 12],
    [45.7, 48.1, null],
    [45.69, 48.1, 5],
    [50, 48.1, null],
    [null, 48.1, null],
    [10, null, null],
    [10, 0, null],
  ])("price %s market %s -> %s", (p, m, want) =>
    expect(underMarket(p, m)).toBe(want),
  );
});
