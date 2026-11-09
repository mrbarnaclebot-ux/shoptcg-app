import { describe, expect, it } from "vitest";
import { seedAllowed } from "@/lib/e2e-seed";

describe("seedAllowed", () => {
  it("needs E2E_SEED=1 and refuses every deployed marker", () => {
    expect(seedAllowed({ E2E_SEED: "1" })).toBe(true);
    expect(seedAllowed({})).toBe(false);
    expect(seedAllowed({ E2E_SEED: "true" })).toBe(false);
    for (const k of [
      "RAILWAY_ENVIRONMENT",
      "RAILWAY_ENVIRONMENT_ID",
      "RAILWAY_PROJECT_ID",
    ])
      expect(seedAllowed({ E2E_SEED: "1", [k]: "x" })).toBe(false);
  });
});
