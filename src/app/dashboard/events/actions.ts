"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { blockBuyer, createEvent, endEvent, LIMITS } from "@/lib/claim-events";
import { declineRequest } from "@/lib/requests";
import { requireStore } from "@/lib/session";

const price = z
  .string()
  .trim()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter a price like 25 or 25.50.")
  .refine((v) => Number(v) > 0, "Enter a price above 0.");

const eventSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Give the event a name.")
      .max(80, "Use 80 characters or fewer."),
    startsAt: z.coerce.date({ error: "Pick when it starts." }),
    endsAt: z.coerce.date({ error: "Pick when it ends." }),
    priceMode: z.enum(["market", "custom"]),
    allowUnclaim: z.boolean(),
    payWithinHours: z.number().int().min(1).max(168),
    maxPerBuyer: z.number().int().min(1).max(99),
    items: z
      .array(
        z.object({
          listingId: z.uuid(),
          price: price.nullable(),
          maxPerBuyer: z.number().int().min(1).max(99),
        }),
      )
      .min(1, "Pick at least one item.")
      .max(LIMITS.maxItems),
  })
  .refine((e) => e.endsAt > e.startsAt, {
    message: "End after it starts.",
    path: ["endsAt"],
  })
  .refine((e) => +e.endsAt - +e.startsAt <= LIMITS.maxDays * 86_400_000, {
    message: `An event runs ${LIMITS.maxDays} days at most.`,
    path: ["endsAt"],
  })
  .refine((e) => +e.endsAt > Date.now(), {
    message: "Pick an end in the future.",
    path: ["endsAt"],
  });

export type CreateResult = { ok: true; id: string } | { error: string };

export async function createEventAction(input: unknown): Promise<CreateResult> {
  const { store } = await requireStore();
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // A start a moment in the past just means now.
  const startsAt = new Date(Math.max(+parsed.data.startsAt, Date.now()));
  if (startsAt >= parsed.data.endsAt) return { error: "End after it starts." };
  try {
    return await createEvent(getDb(), store.id, { ...parsed.data, startsAt });
  } catch (err) {
    console.error("[events] create failed", err);
    return { error: "Couldn't save that. Try again." };
  }
}

const id = z.uuid();

export async function endEventAction(eventId: string) {
  const { store } = await requireStore();
  const ok = id.safeParse(eventId).success
    ? await endEvent(getDb(), store.id, eventId)
    : false;
  refresh();
  return ok;
}

/** Releases one buyer's claims; in a live event the units go straight back. */
export async function releaseAction(requestId: string) {
  const { store } = await requireStore();
  const ok = id.safeParse(requestId).success
    ? await declineRequest(getDb(), store.id, requestId)
    : false;
  refresh();
  return ok;
}

/** Releases their claims and stops that phone and email joining again. */
export async function blockAction(requestId: string) {
  const { store } = await requireStore();
  const ok = id.safeParse(requestId).success
    ? await blockBuyer(getDb(), store.id, requestId)
    : false;
  refresh();
  return ok;
}
