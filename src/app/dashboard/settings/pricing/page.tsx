import type { Metadata } from "next";
import { requireStore } from "@/lib/session";
import { SettingsPage } from "../section";
import { PricingForm } from "../settings-form";

export const metadata: Metadata = { title: "Pricing - tcgmart" };

export default function PricingPage() {
  return (
    <SettingsPage title="Pricing">
      <Pricing />
    </SettingsPage>
  );
}

async function Pricing() {
  const { store } = await requireStore();
  return (
    <PricingForm
      values={{
        priceRulePct: store.priceRulePct,
        rounding: String(Number(store.rounding)),
        secondCurrency: store.secondCurrency ?? "",
        fxRate: store.fxRate === null ? "" : String(Number(store.fxRate)),
      }}
    />
  );
}
