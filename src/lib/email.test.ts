import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { outboxPath } = await import("@/lib/email");

describe("outboxPath", () => {
  it("allows the outbox only off deployed services", () => {
    expect(outboxPath({ MAGIC_LINK_OUTBOX: "/tmp/o" })).toBe("/tmp/o");
    expect(outboxPath({})).toBeNull();
    expect(outboxPath({ RAILWAY_PROJECT_ID: "p" })).toBeNull();
    for (const k of [
      "RAILWAY_ENVIRONMENT",
      "RAILWAY_ENVIRONMENT_ID",
      "RAILWAY_PROJECT_ID",
    ])
      expect(() =>
        outboxPath({ MAGIC_LINK_OUTBOX: "/tmp/o", [k]: "x" }),
      ).toThrow(/deployed/);
  });
});
