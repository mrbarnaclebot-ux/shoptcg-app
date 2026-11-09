import type { NextConfig } from "next";
import { IMAGE_HOSTS } from "./src/lib/pricing/images";

const nextConfig: NextConfig = {
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
  // The code is in the URL: never pass it to another site.
  async headers() {
    return [
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

export default nextConfig;
