import type { Metadata } from "next";
import { vapid } from "@/lib/push";
import { requireStore } from "@/lib/session";
import { AlertsRow, InstallNudge } from "../../requests/alerts";
import { SettingsPage } from "../section";

export const metadata: Metadata = { title: "Alerts" };

export default function AlertsPage() {
  return (
    <SettingsPage title="Alerts">
      <Alerts />
    </SettingsPage>
  );
}

async function Alerts() {
  await requireStore();
  // One switch: a tile grid would be a single box, so it keeps reading width.
  return (
    <div className="flex max-w-xl flex-col gap-8">
      <p className="text-muted-foreground">
        A chime plays when a buyer sends a list. With sound on, this device also
        gets an alert while it is locked. Each phone or computer has its own
        switch.
      </p>
      <AlertsRow publicKey={vapid()?.publicKey ?? null} />
      <InstallNudge />
    </div>
  );
}
