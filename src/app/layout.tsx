import type { Metadata } from "next";
import { Big_Shoulders, Schibsted_Grotesk } from "next/font/google";
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
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "tcgmart",
  description:
    "Your card show table, priced live. Buyers scan your QR, pick and ping you.",
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
