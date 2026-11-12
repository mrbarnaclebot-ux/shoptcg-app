import { describe, expect, it } from "vitest";
import { checkEnv } from "@/lib/env-check";

const ok = {
  BETTER_AUTH_SECRET: "s",
  BETTER_AUTH_URL: "https://shop.example",
  RESEND_API_KEY: "r",
  DATABASE_URL: "postgres://x",
  PPT_API_KEY: "k",
  VAPID_PUBLIC_KEY: "a",
  VAPID_PRIVATE_KEY: "b",
  VAPID_SUBJECT: "mailto:o@example.test",
  PINATA_JWT: "j",
  PINATA_GATEWAY_URL: "x.mypinata.cloud",
  EMAIL_FROM: "shoptcg <hello@shop.example>",
};

describe("checkEnv", () => {
  it("passes a complete environment", () => {
    expect(checkEnv(ok)).toEqual({ errors: [], warnings: [] });
  });

  it("refuses a missing required value", () => {
    expect(checkEnv({ ...ok, DATABASE_URL: "" }).errors).toHaveLength(1);
  });

  it("refuses half a VAPID key set, and only warns when all are missing", () => {
    expect(checkEnv({ ...ok, VAPID_PRIVATE_KEY: undefined }).errors[0]).toMatch(
      /all of VAPID/,
    );
    const none = checkEnv({
      ...ok,
      VAPID_PUBLIC_KEY: undefined,
      VAPID_PRIVATE_KEY: undefined,
      VAPID_SUBJECT: undefined,
      PPT_API_KEY: undefined,
    });
    expect(none.errors).toEqual([]);
    expect(none.warnings).toHaveLength(2);
  });

  it("refuses half the Pinata pair", () => {
    expect(
      checkEnv({ ...ok, PINATA_GATEWAY_URL: undefined }).errors[0],
    ).toMatch(/both of PINATA/);
  });

  it("refuses test hooks on a deployed service only", () => {
    const hooks = { ...ok, MAGIC_LINK_OUTBOX: "/tmp/x", E2E_SEED: "1" };
    expect(checkEnv(hooks).errors).toEqual([]);
    expect(
      checkEnv({ ...hooks, RAILWAY_ENVIRONMENT: "production" }).errors,
    ).toHaveLength(2);
  });

  it("warns while mail still goes from Resend's test sender", () => {
    for (const EMAIL_FROM of [undefined, "shoptcg <onboarding@resend.dev>"])
      expect(checkEnv({ ...ok, EMAIL_FROM }).warnings[0]).toMatch(/EMAIL_FROM/);
  });

  it("refuses a canonical host that isn't BETTER_AUTH_URL's", () => {
    expect(checkEnv({ ...ok, CANONICAL_HOST: "shop.example" }).errors).toEqual(
      [],
    );
    expect(
      checkEnv({ ...ok, CANONICAL_HOST: "other.example" }).errors[0],
    ).toMatch(/CANONICAL_HOST/);
  });
});
