"use client";

import { useEffect } from "react";
import { ShowMoment } from "@/components/show-moment";
import { TicketButton } from "@/components/ticket-button";

// Rendered after createStoreAction redirects to ?created=1. The store starts
// closed (no pings before doors open), so the moment says "set", not "open";
// the switch under it opens the table. The flag is dropped from the URL so a
// reload never replays it.
// ponytail: a shared or back-navigated ?created=1 replays the moment. Harmless
// for the owner; add a server-side "celebrated" flag if it matters.
export function StoreCreated({ slug }: { slug: string }) {
  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.delete("created");
    history.replaceState(null, "", url);
  }, []);
  return (
    <ShowMoment stamp="Set up" headline="Your table is set" no="0001">
      <p className="text-muted-foreground">
        shoptcg.app/{slug} is live with <span className="num">0</span> items.
        Stock the table, then open it below when doors open.
      </p>
      <TicketButton href="/dashboard/inventory/add" className="self-start">
        Add your first card
      </TicketButton>
    </ShowMoment>
  );
}
