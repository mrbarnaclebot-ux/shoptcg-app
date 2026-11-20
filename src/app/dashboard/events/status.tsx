import { Stamp } from "@/components/stamp";
import type { EventStatus } from "@/lib/claim-events";
import { STATUS_LABEL } from "./format";

// Lamp orange only while buyers can claim; the rest are inked or faded.
const TONE: Record<EventStatus, string> = {
  live: "",
  scheduled: "text-text",
  sold_out: "text-muted-foreground",
  ended: "text-muted-foreground",
};

/** An event's status as a rubber stamp, like a sale's "Paid" or "Voided". */
export function StatusStamp(props: {
  status: EventStatus;
  className?: string;
}) {
  return (
    <Stamp className={`${TONE[props.status]} ${props.className ?? ""}`}>
      {STATUS_LABEL[props.status]}
    </Stamp>
  );
}
