import { describe, expect, it } from "vitest";
import { canonicalRedirect } from "@/lib/canonical-host";

const OLD = "web-production-2d3b0.up.railway.app";
const url = (p: string) => new URL(p, `https://${OLD}`);
const env = { CANONICAL_HOST: "tcgmart.app" };

describe("canonicalRedirect", () => {
  it("is off while CANONICAL_HOST is unset", () => {
    expect(canonicalRedirect("GET", OLD, url("/my-store"), {})).toBeNull();
  });

  it("sends an old host to the same path and query on the new one", () => {
    expect(
      canonicalRedirect("GET", OLD, url("/my-store/item/x?r=1"), env)?.href,
    ).toBe("https://tcgmart.app/my-store/item/x?r=1");
    expect(canonicalRedirect("HEAD", OLD, url("/"), env)?.href).toBe(
      "https://tcgmart.app/",
    );
  });

  it("leaves the canonical host, posts and the healthcheck alone", () => {
    expect(canonicalRedirect("GET", "TcgMart.app", url("/a"), env)).toBeNull();
    expect(canonicalRedirect("POST", OLD, url("/api/visit"), env)).toBeNull();
    expect(canonicalRedirect("GET", OLD, url("/api/health"), env)).toBeNull();
    expect(canonicalRedirect("GET", null, url("/"), env)).toBeNull();
  });
});
