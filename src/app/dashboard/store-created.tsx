"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RipMoment } from "@/components/rip-moment";
import { buttonVariants } from "@/components/ui/button";
import { toast } from "@/lib/toast";

// Rendered once after createStoreAction redirects to ?created=1. The flag is
// dropped from the URL so a reload never replays the moment.
// ponytail: not a one-time flag; a shared or back-navigated ?created=1 replays the
// toast. Harmless for the owner; add a server-side "celebrated" flag if it matters.
export function StoreCreated({ slug }: { slug: string }) {
  useEffect(() => {
    const url = new URL(location.href);
    if (!url.searchParams.has("created")) return;
    url.searchParams.delete("created");
    history.replaceState(null, "", url);
    toast.storeCreated(slug);
  }, [slug]);
  return (
    <RipMoment kicker="Store created" headline="You're open">
      <p className="text-muted-foreground">
        shoptcg.app/{slug} is live. <span className="num text-text">0</span>{" "}
        items. Time to stock it.
      </p>
      <Link
        href="/dashboard/inventory/add"
        className={buttonVariants({ size: "lg", className: "self-start" })}
      >
        Add your first card
      </Link>
    </RipMoment>
  );
}
