import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Schibsted_Grotesk } from "next/font/google";
import { appUrl } from "@/lib/deployed";
import "./globals.css";

// Poster face for numbers, prices and names you read from three metres away.
// The opsz axis carries the Display cut (pinned to 72 in tokens.css).
const poster = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-poster",
  display: "swap",
  // Next has no metrics for it; globals.css declares size-adjusted fallbacks.
  adjustFontFallback: false,
  fallback: [
    "Big Shoulders Fallback",
    "Big Shoulders Fallback Arial",
    "sans-serif",
  ],
});

// Newsprint grotesk for everything read up close.
const body = Schibsted_Grotesk({
  // subsets picks what is preloaded; accented names still render (on demand).
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  // Without it, opengraph-image.jpg's URL is built from localhost on Railway.
  // appUrl() is BETTER_AUTH_URL, which the boot check holds to CANONICAL_HOST.
  metadataBase: appUrl(),
  title: {
    default: "tcgmart – live-priced Pokemon card store for vendors",
    // Pages give only their own name.
    template: "%s – tcgmart",
  },
  description:
    "Run your Pokemon card business online and at shows: one live-priced store, carts that ping your phone, and a ledger that keeps the books.",
  // No og:title here, so each page's title becomes its own. Store and item
  // pages set their own image; every other page shares opengraph-image.jpg.
  openGraph: { siteName: "tcgmart", type: "website" },
  twitter: { card: "summary_large_image" },
};

// cover: the page runs under the notch and home bar, so the bars' existing
// env(safe-area-inset-*) padding takes effect. The theme colour is the hall.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#090911",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${poster.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
