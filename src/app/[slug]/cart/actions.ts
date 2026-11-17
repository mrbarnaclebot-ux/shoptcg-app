"use server";

import { cookies } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { ensureBuyerSid, readBuyerSid } from "@/lib/buyer-session";
import { parseCheckout, storeOffer, type CheckoutErrors } from "@/lib/checkout";
import { seedAllowed } from "@/lib/e2e-seed";
import { previewing } from "@/lib/preview";
import { pushNewRequest } from "@/lib/push";
import { cancelRequest, createRequest, MAX_LINES } from "@/lib/requests";
import { HOLD_MS, type SellingMode } from "@/lib/selling-mode";
import { getPublicStore } from "@/lib/storefront";
import { addressHash } from "../address-hash";

export type SendResult =
  | { ok: true; id: string }
  | { fieldErrors: { name?: string; email?: string } & CheckoutErrors }
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

/** The store's hold; e2e shortens it with a cookie, never on a deployed service. */
async function holdMs(mode: SellingMode) {
  if (!seedAllowed(process.env)) return HOLD_MS[mode];
  const ms = Number((await cookies()).get("e2e_hold_ms")?.value);
  return ms > 0 ? ms : HOLD_MS[mode];
}

export async function sendRequest(
  slug: string,
  form: FormData,
): Promise<SendResult> {
  const raw = Object.fromEntries(form);
  const fields = sendSchema.safeParse(raw);
  const lines = parseLines(form.get("lines"));
  if (fields.success && !lines.success) return { empty: true };
  const db = getDb();
  const store = await getPublicStore(db, slug);
  const checkout = store ? parseCheckout(storeOffer(store), raw) : null;
  // Every field's message at once, so the buyer fixes them in one go.
  if (!fields.success || (checkout && "errors" in checkout)) {
    const e = fields.success ? {} : z.flattenError(fields.error).fieldErrors;
    return {
      fieldErrors: {
        name: e.name?.[0],
        email: e.email?.[0],
        ...(checkout && "errors" in checkout ? checkout.errors : {}),
      },
    };
  }
  if (!lines.success) return { empty: true };
  // The owner's preview sends a test request, open or not.
  const isTest = Boolean(store) && (await previewing(slug));
  if (!store || (store.state !== "open" && !isTest)) return { closed: true };
  const sessionId = await ensureBuyerSid();
  const ip = await addressHash();
  const hold = await holdMs(store.sellingMode);
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
      isTest,
      checkout: checkout?.value,
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
