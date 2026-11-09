"use client";

import { Printer } from "lucide-react";
import { TicketButton } from "@/components/ticket-button";

export function PrintButton() {
  return (
    <TicketButton
      icon={<Printer className="size-[18px]" />}
      onClick={() => window.print()}
    >
      Print
    </TicketButton>
  );
}
