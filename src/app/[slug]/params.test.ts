import { describe, expect, it } from "vitest";
import { filterHref, parseFilter, parseRange } from "./params";

describe("store params", () => {
  it("keeps known values and drops the rest", () => {
    expect(
      parseFilter({
        type: "graded",
        lang: ["ja", "xx", "ja"],
        q: "  zard ",
        sort: "bad",
      }),
    ).toEqual({ type: "graded", langs: ["ja"], q: "zard", sort: undefined });
    expect(parseFilter({ type: ["sealed", "raw"], lang: "zh" })).toMatchObject({
      type: "sealed",
      langs: ["zh"],
    });
    expect(parseFilter({ q: "x".repeat(99) }).q).toHaveLength(60);
  });

  it("round-trips through the URL", () => {
    expect(
      filterHref("ridge", { type: "raw", langs: ["ja", "zh"], sort: "name" }),
    ).toBe("/ridge?type=raw&lang=ja&lang=zh&sort=name");
    expect(filterHref("ridge", { sort: "price-desc" })).toBe("/ridge");
    expect(parseRange({ range: "90" })).toBe(90);
    expect(parseRange({ range: "7" })).toBe(30);
  });
});
