import { describe, expect, it } from "vitest";
import { certNo, receiptTime, safeTimeZone, withLanguage } from "./format";

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

it("only a real IANA zone gets through", () => {
  expect(safeTimeZone("America/Los_Angeles")).toBe("America/Los_Angeles");
  expect(safeTimeZone("America/Argentina/Buenos_Aires")).toBe(
    "America/Argentina/Buenos_Aires",
  );
  for (const bad of [
    undefined,
    "",
    "Mars/Olympus",
    "+03:00",
    "a'; drop",
    "x".repeat(65),
  ])
    expect(safeTimeZone(bad)).toBe("UTC");
});

it("a receipt time is in the seller's zone, and says so", () => {
  const at = new Date("2026-11-08T05:00:00Z");
  expect(receiptTime(at, "America/Los_Angeles")).toMatch(
    /^Nov 7, 2026.*9:00.PM PST$/,
  );
  expect(receiptTime(at, "UTC")).toMatch(/^Nov 8, 2026.*5:00.AM UTC$/);
});

it("only a non-English line names its language", () => {
  expect(withLanguage("151 NM", "en")).toBe("151 NM");
  expect(withLanguage("151 NM", "ja")).toBe("151 NM. JP");
  expect(withLanguage("", "zh")).toBe("CN");
});
