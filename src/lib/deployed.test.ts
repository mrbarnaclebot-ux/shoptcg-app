import { describe, expect, it } from "vitest";
import { isDeployed } from "@/lib/deployed";

describe("isDeployed", () => {
  it("is true for any Railway marker", () => {
    expect(isDeployed({})).toBe(false);
    expect(isDeployed({ NODE_ENV: "production" })).toBe(false);
    expect(isDeployed({ RAILWAY_PROJECT_ID: "p" })).toBe(true);
  });
});

