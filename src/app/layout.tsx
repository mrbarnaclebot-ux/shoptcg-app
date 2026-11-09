import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// Variable Archivo; the width axis drives the expanded heading voice.
const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "shoptcg",
  description: "Live-priced Pokemon TCG stock for card show vendors.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
