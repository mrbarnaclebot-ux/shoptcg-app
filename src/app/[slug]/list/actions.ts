"use server";

import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { ensureBuyerSid, readBuyerSid } from "@/lib/buyer-session";
import { outboxPath } from "@/lib/email";
import { seedAllowed } from "@/lib/e2e-seed";
import { pushNewRequest } from "@/lib/push";
import { ipHash } from "@/lib/request-limit";
import {
  cancelRequest,
  createRequest,
  HOLD_MS,
  MAX_LINES,
} from "@/lib/requests";
import { clientIp } from "@/lib/sign-in-limit";
import { getPublicStore } from "@/lib/storefront";

export type SendResult =
  | { ok: true; id: string }
  | { fieldErrors: { name?: string; email?: string } }
  | { taken: string[] }
  | { closed: true }
  | { limited: true }
  | { empty: true };

const linesSchema = z
  .array(
    z.object({
      listingId: z.uuid(),
      qty: z.number().int().min(1).max(99),
    }),
  )
  .min(1)
  .max(MAX_LINES)
  // The same listing twice would trip the primary key; the last qty wins.
  .transform((ls) => [...new Map(ls.map((l) => [l.listingId, l])).values()]);

const sendSchema = z.object({
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
  promo: z.literal("on").optional(),
});

function parseLines(raw: FormDataEntryValue | null) {
  try {
    return linesSchema.safeParse(JSON.parse(String(raw)));
  } catch {
    return linesSchema.safeParse(null);
  }
}

/** e2e shortens holds with a cookie; never honoured on a deployed service. */
async function holdMs() {
  if (!seedAllowed(process.env)) return HOLD_MS;
  const ms = Number((await cookies()).get("e2e_hold_ms")?.value);
  return ms > 0 ? ms : HOLD_MS;
}

// e2e sends from one machine; the per-phone limits still apply there.
async function addressHash() {
  const ip = outboxPath(process.env) ? null : clientIp(await headers());
  const secret = process.env.BETTER_AUTH_SECRET;
  return ip && secret ? ipHash(ip, secret) : null;
}

export async function sendRequest(
  slug: string,
  form: FormData,
): Promise<SendResult> {
  const fields = sendSchema.safeParse(Object.fromEntries(form));
  if (!fields.success) {
    const e = z.flattenError(fields.error).fieldErrors;
    return { fieldErrors: { name: e.name?.[0], email: e.email?.[0] } };
  }
  const lines = parseLines(form.get("lines"));
  if (!lines.success) return { empty: true };
  const db = getDb();
  const store = await getPublicStore(db, slug);
  if (!store?.isOpen) return { closed: true };
  const sessionId = await ensureBuyerSid();
  const ip = await addressHash();
  const hold = await holdMs();
  let r;
  try {
    r = await createRequest(db, {
      sessionId,
      storeId: store.id,
      ipHash: ip,
      lines: lines.data,
      buyerName: fields.data.name,
      buyerEmail: fields.data.email,
      promo: fields.data.promo === "on",
      holdMs: hold,
    });
  } catch (err) {
    // A failed query's message carries its params: the buyer's name and email.
    const code = (err as { cause?: { code?: string } }).cause?.code;
    console.error("[request] send failed", code);
    throw new Error("Request not sent");
  }
  if (!r.ok) {
    if ("closed" in r) return { closed: true };
    return "limited" in r ? { limited: true } : { taken: r.taken };
  }
  if (!r.retry)
    after(() => pushNewRequest(db, store.id, { ...r, name: fields.data.name }));
  return { ok: true, id: r.id };
}

/**
 * Mints the cookie before the send: if a send's response is lost, the retry
 * still has the session that owns the request.
 */
export async function startBuyerSession() {
  await ensureBuyerSid();
}

/** The buyer lets their hold go. False when it was not theirs or already over. */
export async function cancelMyRequest(id: string) {
  const sid = await readBuyerSid();
  if (!sid || !z.uuid().safeParse(id).success) return false;
  return cancelRequest(getDb(), sid, id);
}
