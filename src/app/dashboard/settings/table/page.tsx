import type { Metadata } from "next";
import Link from "next/link";
import { lineButton } from "@/components/ticket-button";
import { requireStore } from "@/lib/session";
import { SettingsPage } from "../section";
import { TableForm } from "../settings-form";

export const metadata: Metadata = { title: "How you sell - shoptcg" };

export default function TablePage() {
  return (
    <SettingsPage title="How you sell">
      <Table />
    </SettingsPage>
  );
}

async function Table() {
  const { store } = await requireStore();
  return (
    <>
      <TableForm
        sellingMode={store.sellingMode}
        tableLabel={store.tableLabel ?? ""}
        nfcEnabled={store.nfcEnabled}
      />
      <div className="flex flex-col items-start gap-3 border-t border-border pt-6">
        <p className="text-sm text-muted-foreground">
          Buyers reach your store by scanning the sign on your table.
        </p>
        <Link href="/dashboard/sign" className={lineButton}>
          Print table sign
        </Link>
      </div>
    </>
  );
}
