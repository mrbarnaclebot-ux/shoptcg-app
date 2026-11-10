import { Suspense } from "react";
import { getDb } from "@/db";
import { isAdminEmail } from "@/lib/admin";
import { requireUser } from "@/lib/session";
import { getStoreByOwner } from "@/lib/stores";
import { SettingsMenu } from "./menu";

export default function SettingsLayout({
  children,
}: LayoutProps<"/dashboard/settings">) {
  return (
    <div className="mx-auto grid w-full max-w-lg flex-1 content-start gap-x-14 gap-y-6 px-4 pt-8 pb-16 md:px-6 lg:max-w-[1000px] lg:grid-cols-[14rem_minmax(0,32rem)] lg:px-8">
      {/* Who is signed in decides the rows, so the menu streams. */}
      <Suspense fallback={<div className="hidden lg:block" />}>
        <Menu />
      </Suspense>
      {children}
    </div>
  );
}

async function Menu() {
  const user = await requireUser();
  const store = await getStoreByOwner(getDb(), user.id);
  return (
    <SettingsMenu hasStore={Boolean(store)} admin={isAdminEmail(user.email)} />
  );
}
