import type { EventStatus } from "@/lib/claim-events";

export const STATUS_LABEL: Record<EventStatus, string> = {
  scheduled: "Scheduled",
  live: "Live",
  sold_out: "All claimed",
  ended: "Ended",
};

/** "Fri, Nov 21, 7:00 PM" in the seller's zone. */
export const eventTime = (d: Date, timeZone: string) =>
  d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
