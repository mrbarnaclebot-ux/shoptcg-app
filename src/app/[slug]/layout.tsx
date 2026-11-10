import { Suspense } from "react";
import { getDb } from "@/db";
import { previewing } from "@/lib/preview";
import { getPublicStore } from "@/lib/storefront";
import { PreviewNote } from "./preview-note";

const SEEN = {
  open: "it is open for buyers too.",
  paused: "buyers can browse but not send lists.",
  off: "buyers see no stock.",
} as const;

export default function StoreLayout({
  children,
  params,
}: LayoutProps<"/[slug]">) {
  return (
    <>
      <Suspense>
        <Preview params={params} />
      </Suspense>
      {children}
    </>
  );
}

/** Says so whenever the owner is looking at the preview, not the real page. */
async function Preview({ params }: Pick<LayoutProps<"/[slug]">, "params">) {
  const { slug } = await params;
  if (!(await previewing(slug))) return null;
  // The real state: the pages below were told "open".
  const real = await getPublicStore(getDb(), slug);
  return <PreviewNote seen={real ? SEEN[real.state] : ""} />;
}
