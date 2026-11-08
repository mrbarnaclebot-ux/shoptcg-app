import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseUrl } from "@/db/url";

afterEach(() => vi.unstubAllEnvs());

describe("databaseUrl", () => {
  it("allows the PGlite fallback in development", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RAILWAY_ENVIRONMENT", "");
    expect(databaseUrl()).toBeFalsy();
  });
  it.each([
    ["NODE_ENV", "production"],
    ["RAILWAY_ENVIRONMENT", "production"],
  ])("throws without a URL when %s=%s", (key, value) => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv(key, value);
    expect(() => databaseUrl()).toThrow("DATABASE_URL is required");
  });
  it("returns the URL when set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://x");
    expect(databaseUrl()).toBe("postgres://x");
  });
});
