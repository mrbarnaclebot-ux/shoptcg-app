"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { ensureBuyerSid, readBuyerSid } from "@/lib/buyer-session";
import {
  claim,
  joinEvent,
  normalizePhone,
  publicEvent,
  roomState,
  unclaim,
  type Room,
} from "@/lib/claim-events";
import { clientIp } from "@/lib/sign-in-limit";
import { humanCheck } from "@/lib/turnstile";
import { addressHash } from "../../address-hash";

export type JoinResult =
  | { ok: true; room: Room }
  | { fieldErrors: { name?: string; phone?: string; email?: string } }
  | { error: string };

export type ClaimResult = { room: Room | null; message?: string };

const joinSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(80, "Use 80 characters or fewer."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter an email like name@example.com.").max(254)),
  phone: z.string().max(30, "Enter a phone number like +94 77 123 4567."),
});

const eventOf = (slug: string, id: string) =>
  z.uuid().safeParse(id).success ? publicEvent(getDb(), id, slug) : null;

async function room(slug: string, id: string) {
  const e = await eventOf(slug, id);
  return e ? roomState(getDb(), e, await readBuyerSid()) : null;
}

/** The buyer's name, WhatsApp and email, plus the bot check, once per event. */
export async function joinClaimEvent(
  slug: string,
  id: string,
  form: FormData,
): Promise<JoinResult> {
  const e = await eventOf(slug, id);
  if (!e) return { error: "This event is no longer here." };
  const raw = Object.fromEntries(form);
  const fields = joinSchema.safeParse({ ...raw, phone: raw.phone ?? "" });
  const phone = normalizePhone(String(raw.phone ?? ""), e.whatsapp);
  if (!fields.success || !phone) {
    const err = fields.success ? {} : z.flattenError(fields.error).fieldErrors;
    return {
      fieldErrors: {
        name: err.name?.[0],
        email: err.email?.[0],
        phone: phone
          ? undefined
          : "Enter your WhatsApp number with the country code, like +94 77 123 4567.",
      },
    };
  }
  const token = String(raw["cf-turnstile-response"] ?? "");
  if (!(await humanCheck(token, clientIp(await headers()))))
    return { error: "We couldn't check you're a person. Try again." };
  const sessionId = await ensureBuyerSid();
  let r;
  try {
    r = await joinEvent(
      getDb(),
      e,
      { sessionId, ipHash: await addressHash() },
      { name: fields.data.name, email: fields.data.email, phone },
    );
  } catch (err) {
    // A failed query's message carries its params: the buyer's details.
    const code = (err as { cause?: { code?: string } }).cause?.code;
    console.error("[claim] join failed", code);
    return { error: "Couldn't join. Check your connection and try again." };
  }
  if ("ok" in r) return { ok: true, room: (await room(slug, id))! };
  if ("taken" in r)
    return {
      fieldErrors:
        r.taken === "phone"
          ? { phone: "This number has already joined this event." }
          : { email: "This email has already joined this event." },
    };
  if ("blocked" in r)
    return { error: `${e.storeName} isn't taking claims from you.` };
  if ("limited" in r)
    return {
      error: "Too many people joined from this connection. Try mobile data.",
    };
  return { error: "This event has ended." };
}

const MESSAGES = {
  notJoined: "Join the event first.",
  notLive: "Claiming isn't open right now.",
  taken: "Just claimed by someone else.",
  slow: "One claim a second. Try again.",
} as const;

/** Claims one unit; the fresh room comes back so the page updates at once. */
export async function claimItem(
  slug: string,
  id: string,
  listingId: string,
): Promise<ClaimResult> {
  const sid = await readBuyerSid();
  const e = await eventOf(slug, id);
  if (!e || !sid || !z.uuid().safeParse(listingId).success)
    return { room: null, message: MESSAGES.notJoined };
  const r = await claim(getDb(), e.id, sid, listingId);
  let message: string | undefined;
  if ("limit" in r)
    message =
      r.limit === "item"
        ? "That's the most of this item you can claim."
        : `You can claim ${e.maxPerBuyer} ${e.maxPerBuyer === 1 ? "item" : "items"} in this event.`;
  else if (!("ok" in r))
    message = MESSAGES[Object.keys(r)[0] as keyof typeof MESSAGES];
  return { room: await roomState(getDb(), e, sid), message };
}

/** Gives one unit back, when the event allows it. */
export async function unclaimItem(
  slug: string,
  id: string,
  listingId: string,
): Promise<ClaimResult> {
  const sid = await readBuyerSid();
  const e = await eventOf(slug, id);
  if (!e || !sid || !z.uuid().safeParse(listingId).success)
    return { room: null };
  const ok = await unclaim(getDb(), e.id, sid, listingId);
  return {
    room: await roomState(getDb(), e, sid),
    message: ok ? undefined : "That can't be given back now.",
  };
}
