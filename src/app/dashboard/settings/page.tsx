import type { Metadata } from "next";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { requireStore } from "@/lib/session";
import { signOutAction } from "../actions";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings - shoptcg" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 pt-8 pb-16">
      <h1 className="text-3xl font-extrabold wdth-125">Store settings</h1>
      <Suspense
        fallback={
          <div className="h-[640px] animate-pulse rounded-lg bg-surface" />
        }
      >
        <Settings />
      </Suspense>
      <form action={signOutAction} className="border-t border-border pt-6">
        <Button type="submit" variant="secondary" size="lg">
          Sign out
        </Button>
      </form>
    </main>
  );
}

async function Settings() {
  const { user, store } = await requireStore();
  return (
    <>
      <p className="-mt-6 text-sm text-subtle">Signed in as {user.email}</p>
      <SettingsForm
        values={{
          priceRulePct: store.priceRulePct,
          rounding: String(Number(store.rounding)),
          secondCurrency: store.secondCurrency ?? "",
          fxRate: store.fxRate === null ? "" : String(Number(store.fxRate)),
          nfcEnabled: store.nfcEnabled,
          isOpen: store.isOpen,
        }}
      />
    </>
  );
}
