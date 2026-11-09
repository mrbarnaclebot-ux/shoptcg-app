import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { lineButton } from "@/components/ticket-button";
import { isAdminEmail } from "@/lib/admin";
import { requireStore } from "@/lib/session";
import { SettingsForm } from "./settings-form";
import { SignOut } from "./sign-out";

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
      <nav aria-label="More" className="flex flex-wrap gap-3">
        <Link href="/dashboard/customers" className={lineButton}>
          Customers
        </Link>
        <Link href="/dashboard/reports" className={lineButton}>
          Sales report
        </Link>
      </nav>
      <SignOut className={lineButton} />
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
          tableLabel: store.tableLabel ?? "",
          nfcEnabled: store.nfcEnabled,
        }}
      />
      {isAdminEmail(user.email) && (
        <Link href="/admin" className={`${lineButton} self-start`}>
          Invites and accounts
        </Link>
      )}
    </>
  );
}
