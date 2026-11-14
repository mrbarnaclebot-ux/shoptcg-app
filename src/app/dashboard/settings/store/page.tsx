import { Type } from "lucide-react";
import type { Metadata } from "next";
import { bento } from "@/components/bento";
import { SectionMark } from "@/components/section-mark";
import { requireStore } from "@/lib/session";
import { SettingsPage } from "../section";
import { NameForm } from "../settings-form";
import { StoreImages } from "../store-images";

export const metadata: Metadata = { title: "Store profile - tcgmart" };

export default function StoreProfilePage() {
  return (
    <SettingsPage title="Store profile">
      <Profile />
    </SettingsPage>
  );
}

async function Profile() {
  const { store } = await requireStore();
  return (
    <div className={bento}>
      <section aria-labelledby="name-h" className="flex flex-col gap-4">
        <SectionMark n={1} id="name-h" icon={Type}>
          Name
        </SectionMark>
        <NameForm name={store.name} />
      </section>
      <StoreImages banner={store.bannerUrl} avatar={store.avatarUrl} />
    </div>
  );
}
