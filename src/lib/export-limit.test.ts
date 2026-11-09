import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { exportAllowed } from "./export-limit";

it("allows 30 exports an hour per store", () => {
  const id = randomUUID();
  const t = 1_000_000;
  for (let i = 0; i < 30; i++) expect(exportAllowed(id, t)).toBe(true);
  expect(exportAllowed(id, t)).toBe(false);
  expect(exportAllowed(randomUUID(), t)).toBe(true);
  expect(exportAllowed(id, t + 60 * 60_000)).toBe(true);
});
