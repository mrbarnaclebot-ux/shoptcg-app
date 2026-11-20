import type { Metadata } from "next";
import { Suspense } from "react";
import { requireStore } from "@/lib/session";
import { BackToMore } from "../back-to-more";
import { PreviewFrame } from "./preview-frame";

export const metadata: Metadata = { title: "Preview - tcgmart" };

const NOW = {
  open: "Your store is open, so this is what buyers see right now.",
  paused:
    "Your store is paused. Buyers can browse, but only you see the cart bar.",
  off: "Your store is not vending. Buyers see no stock; only you see this.",
} as const;

export default function PreviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-4 px-4 pt-4 pb-6 md:px-6 lg:px-8">
      <BackToMore />
      <Suspense
        fallback={<div className="h-[70dvh] animate-pulse bg-surface" />}
      >
        <Preview />
      </Suspense>
    </main>
  );
}

async function Preview() {
  const { store } = await requireStore();
  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[2.5rem] leading-[0.88] font-black lg:text-[3.5rem] lg:leading-[0.82]">
          Preview
        </h1>
        <p className="max-w-[60ch] text-sm text-muted-foreground">
          {NOW[store.live]} A cart you send from here arrives as a test request.
        </p>
      </div>
      <PreviewFrame slug={store.slug} name={store.name} />
    </>
  );
}
