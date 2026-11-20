import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "tcgmart",
    short_name: "tcgmart",
    description:
      "Your card store, online and at shows: carts and sales on your phone.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#090911",
    theme_color: "#090911",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Android crops to a circle or squircle: this is icon-512 at 80% on the
      // same hall colour (sharp), so the card stays inside the safe zone.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
