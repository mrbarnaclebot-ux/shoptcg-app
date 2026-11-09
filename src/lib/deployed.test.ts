import { describe, expect, it } from "vitest";
import { appUrl, isDeployed } from "@/lib/deployed";

describe("isDeployed", () => {
  it("is true for any Railway marker", () => {
    expect(isDeployed({})).toBe(false);
    expect(isDeployed({ NODE_ENV: "production" })).toBe(false);
    expect(isDeployed({ RAILWAY_PROJECT_ID: "p" })).toBe(true);
  });
});

describe("appUrl", () => {
  it("uses BETTER_AUTH_URL, falls back to localhost only in development", () => {
    expect(appUrl({ BETTER_AUTH_URL: "https://shoptcg.app/" }).host).toBe(
      "shoptcg.app",
    );
    expect(appUrl({ NODE_ENV: "development" }).origin).toBe(
      "http://localhost:3000",
    );
    expect(() => appUrl({ NODE_ENV: "production" })).toThrow(/required/);
    expect(() => appUrl({ RAILWAY_ENVIRONMENT: "production" })).toThrow(
      /required/,
    );
  });
});
