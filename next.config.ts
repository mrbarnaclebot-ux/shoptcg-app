import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { IMAGE_HOSTS } from "./src/lib/pricing/images";

// No script-src: a nonce needs every page rendered per request, which
// cacheComponents' prerendered shells can't do. These parts touch no script.
// 'self' frame-ancestors keeps the dashboard preview framing the store page.
const CSP = [
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Browsers ignore it over plain http, so localhost is unaffected.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  // The browser SDK reads these at build time; Railway builds with service variables.
  env: {
    NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN ?? "",
    NEXT_PUBLIC_SENTRY_ENV: process.env.RAILWAY_ENVIRONMENT_NAME ?? "",
    NEXT_PUBLIC_SENTRY_RELEASE: process.env.RAILWAY_GIT_COMMIT_SHA ?? "",
  },
  // Test-only routes are named *.e2e.ts and exist only in E2E_SEED=1 builds.
  pageExtensions: [
    "tsx",
    "ts",
    "jsx",
    "js",
    ...(process.env.E2E_SEED === "1" ? ["e2e.ts"] : []),
  ],
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  poweredByHeader: false,
  // The code is in the URL: never pass it to another site.
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        source: "/join/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
  images: {
    // Card art never changes at a URL, so optimised copies live a month.
    minimumCacheTTL: 2_592_000,
    qualities: [70, 75],
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
  // PGlite loads its WASM and data files relative to its own package path.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Source maps upload only when SENTRY_AUTH_TOKEN is set on the build.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  release: { name: process.env.RAILWAY_GIT_COMMIT_SHA },
  silent: !process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
});
