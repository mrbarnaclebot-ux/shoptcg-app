import type { Metadata } from "next";
import { Suspense } from "react";
import { lineButton } from "@/components/ticket-button";
import { requireStore } from "@/lib/session";
import { signOutAction } from "../actions";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings - shoptcg" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 pt-8 pb-16">
      <h1 className="font-display text-[3.5rem] leading-[0.82] font-black">
        Store settings
      </h1>
      <Suspense
        fallback={<div className="h-[640px] animate-pulse bg-surface" />}
      >
        <Settings />
      </Suspense>
      <form action={signOutAction} className="border-t border-border pt-6">
        <button type="submit" className={lineButton}>
          Sign out
        </button>
      </form>
    </main>
  );
}

async function Settings() {
  const { user, store } = await requireStore();
  return (
    <>
      <p className="-mt-7 text-sm text-muted-foreground">
        Signed in as{" "}
        <span className="[overflow-wrap:anywhere]">{user.email}</span>
      </p>
      <SettingsForm
        values={{
          priceRulePct: store.priceRulePct,
          rounding: String(Number(store.rounding)),
          secondCurrency: store.secondCurrency ?? "",
          fxRate: store.fxRate === null ? "" : String(Number(store.fxRate)),
          nfcEnabled: store.nfcEnabled,
        }}
      />
    </>
  );
}
