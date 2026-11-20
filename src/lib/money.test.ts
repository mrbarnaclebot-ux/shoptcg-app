import { expect, test } from "vitest";
import { cashNotes, priceSale, toCents } from "@/lib/money";

const line = (unitPrice: string, qty = 1) => ({ unitPrice, qty });

test("cents are exact where floats are not", () => {
  expect(toCents("1.15")).toBe(115);
  expect(toCents("4.35")).toBe(435);
  expect(toCents("99999.99")).toBe(9999999);
});

test("percent discounts round half up to the cent", () => {
  // 10% of $0.05 is half a cent.
  expect(priceSale([line("0.05")], { kind: "percent", value: "10" })).toEqual({
    subtotal: 5,
    discount: 1,
    total: 4,
    pct: 1000,
  });
  // 12.5% of $3.33 is 41.625 cents.
  expect(
    priceSale([line("3.33")], { kind: "percent", value: "12.5" })?.discount,
  ).toBe(42);
});

test("a discount can't pass the subtotal or 100%", () => {
  const l = [line("10")];
  expect(priceSale(l, { kind: "amount", value: "10.01" })).toBeNull();
  expect(priceSale(l, { kind: "percent", value: "100.01" })).toBeNull();
  expect(priceSale(l, { kind: "amount", value: "10" })?.total).toBe(0);
  expect(priceSale(l, { kind: "percent", value: "abc" })).toBeNull();
});

test("a free throw-in is fine; a malformed price is not", () => {
  expect(
    priceSale([line("0", 2), line("5.50", 3)], { kind: "none" }),
  ).toMatchObject({ subtotal: 1650, total: 1650 });
  for (const bad of ["-1", "1.234", "100000", "", "1e3"])
    expect(priceSale([line(bad)], { kind: "none" })).toBeNull();
});

test("cash notes are the round sums just above the total", () => {
  expect(cashNotes(1300)).toEqual([2000, 5000, 10_000]);
  expect(cashNotes(5895)).toEqual([6000, 10_000]);
  expect(cashNotes(26_550)).toEqual([27_000, 28_000, 30_000]);
  // A total already on a note is Exact, so only bigger ones.
  expect(cashNotes(2000)).toEqual([5000, 10_000]);
  expect(cashNotes(0)).toEqual([]);
});
