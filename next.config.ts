import type { NextConfig } from "next";
import { IMAGE_HOSTS } from "./src/lib/pricing/images";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
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
