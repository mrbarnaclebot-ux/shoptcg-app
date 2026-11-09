import { describe, expect, it } from "vitest";
import { scale, trend } from "./chart-scale";

const pts = (...m: number[]) =>
  m.map((market, i) => ({ date: `d${i}`, market }));

describe("scale", () => {
  it("puts min at the bottom and max at the top, inside the padding", () => {
    const s = scale(pts(10, 20), 100, 50);
    expect(s.x(0)).toBe(0);
    expect(s.x(1)).toBe(100);
    expect(s.y(10)).toBeCloseTo(50 - 50 / 12);
    expect(s.y(20)).toBeCloseTo(50 / 12);
  });

  it("centres a flat line and a single point", () => {
    const flat = scale(pts(5, 5, 5), 100, 50);
    expect(flat.y(5)).toBeCloseTo(25);
    const one = scale(pts(7), 100, 50);
    expect(one.x(0)).toBe(50);
    expect(one.y(7)).toBeCloseTo(25);
  });

  it("widens the range to fit this table's price", () => {
    const s = scale(pts(10, 20), 100, 50, 40);
    expect(s.max).toBeGreaterThan(40);
  });
});

describe("trend", () => {
  it("reports whole percent change", () => {
    expect(trend(pts(100, 108), 30)?.text).toBe("Up 8% in 30 days");
    expect(trend(pts(100, 97), 90)).toEqual({
      dir: "down",
      text: "Down 3% in 90 days",
    });
    expect(trend(pts(1), 30)).toBeNull();
  });
});
