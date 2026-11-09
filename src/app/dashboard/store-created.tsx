"use client";

import { useEffect } from "react";
import { ShowMoment } from "@/components/show-moment";
import { TicketButton } from "@/components/ticket-button";
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
    <ShowMoment stamp="Open" headline="You're open" no="0001">
      <p className="text-muted-foreground">
        shoptcg.app/{slug} is live with <span className="num">0</span> items.
        Time to stock the table.
      </p>
      <TicketButton href="/dashboard/inventory/add" className="self-start">
        Add your first card
      </TicketButton>
    </ShowMoment>
  );
}
