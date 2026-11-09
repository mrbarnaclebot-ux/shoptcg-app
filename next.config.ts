import type { NextConfig } from "next";
import { IMAGE_HOSTS } from "./src/lib/pricing/images";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  images: {
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
