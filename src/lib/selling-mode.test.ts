import { describe, expect, it } from "vitest";
import { tableSchema } from "@/lib/stores";
import { clock } from "@/lib/use-live";
import { HOLD_MS, MODE_COPY, modeCopy, SELLING_MODES } from "./selling-mode";

const strings = (mode: (typeof SELLING_MODES)[number]) =>
  Object.values(MODE_COPY[mode]).map((v) =>
    typeof v === "function" ? v("B14") : String(v),
  );

describe("selling mode copy", () => {
  it("both modes say every line", () => {
    expect(Object.keys(MODE_COPY.online).sort()).toEqual(
      Object.keys(MODE_COPY.table).sort(),
    );
  });

  it("an online store never mentions a table", () => {
    for (const s of strings("online")) expect(s).not.toMatch(/table/i);
    expect(modeCopy("online").showTable).toBe(false);
    expect(modeCopy("online").sentNext).toMatch(
      /confirm your order.*payment and pickup or delivery/,
    );
  });

  it("a table store sends the buyer to the table", () => {
    expect(modeCopy("table").sentNext).toMatch(/Head to the table/);
    expect(modeCopy("table").holdSoon("B14")).toBe(
      "Find the seller at table B14.",
    );
    expect(modeCopy("table").holdSoon(null)).toBe("Find the seller soon.");
  });

  it("holds run 15 minutes at a table and a day online, as the copy says", () => {
    expect(HOLD_MS.table).toBe(15 * 60_000);
    expect(HOLD_MS.online).toBe(24 * 60 * 60_000);
    expect(modeCopy("table").holdNote).toContain("15 minutes");
    expect(modeCopy("online").holdNote).toContain("24 hours");
  });

  it("the settings form takes only a known mode", () => {
    const ok = tableSchema.safeParse({ sellingMode: "online", tableLabel: "" });
    expect(ok.success && ok.data.sellingMode).toBe("online");
    expect(
      tableSchema.safeParse({ sellingMode: "mail", tableLabel: "" }).success,
    ).toBe(false);
  });

  it("the hold clock shows hours once a hold runs past one", () => {
    expect(clock(HOLD_MS.table, 1)).toBe("15:00");
    expect(clock(HOLD_MS.online + 1, 1)).toBe("24:00:00");
    expect(clock(61 * 60_000 + 1, 1)).toBe("1:01:00");
  });
});
