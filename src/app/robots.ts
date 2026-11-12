import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { appUrl } from "@/lib/deployed";

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection(); // the host comes from the runtime env, not the build's
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/api/", "/join", "/login", "/u/"],
    },
    sitemap: new URL("/sitemap.xml", appUrl()).href,
  };
}
