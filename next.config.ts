import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  // Card art hosts: TCGdex (default dev catalog) and the TCGplayer CDN that PPT returns.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.tcgdex.net" },
      { protocol: "https", hostname: "tcgplayer-cdn.tcgplayer.com" },
    ],
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
