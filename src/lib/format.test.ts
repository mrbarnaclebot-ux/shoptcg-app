import { describe, expect, it } from "vitest";
import { certNo } from "./format";

describe("certNo", () => {
  it("is eight digits in two groups and stable per id", () => {
    const id = "0000abcd-1234-4000-8000-000000000000";
    expect(certNo(id)).toBe("0004 3981");
    expect(certNo(id)).toBe(certNo(id));
    expect(certNo("ffffffff-0000-4000-8000-000000000000")).toMatch(
      /^\d{4} \d{4}$/,
    );
  });
});
