import { Link2, Type } from "lucide-react";
import type { Metadata } from "next";
import { bento } from "@/components/bento";
import { SectionMark } from "@/components/section-mark";
import { appUrl } from "@/lib/deployed";
import { requireStore } from "@/lib/session";
import { SettingsPage } from "../section";
import { NameForm, SlugForm } from "../settings-form";
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
      <section aria-labelledby="link-h" className="flex flex-col gap-4">
        <SectionMark n={2} id="link-h" icon={Link2}>
          Link
        </SectionMark>
        <SlugForm slug={store.slug} host={appUrl().host} />
      </section>
      <StoreImages banner={store.bannerUrl} avatar={store.avatarUrl} />
    </div>
  );
}
