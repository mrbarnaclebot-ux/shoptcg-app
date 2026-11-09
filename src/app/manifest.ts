import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "shoptcg",
    short_name: "shoptcg",
    description: "Your card show table: buyer requests on your phone.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#090911",
    theme_color: "#090911",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
