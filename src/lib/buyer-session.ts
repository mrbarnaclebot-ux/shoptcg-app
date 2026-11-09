import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

// Buyers have no account: one random cookie ties the waiting screen, cancel
// and the rate limits to one phone.
export const BUYER_COOKIE = "buyer_sid";
const MAX_AGE = 30 * 24 * 60 * 60;

export async function readBuyerSid() {
  return (await cookies()).get(BUYER_COOKIE)?.value ?? null;
}

/** The phone's id, minted on the first send. Server actions and route handlers only. */
export async function ensureBuyerSid() {
  const jar = await cookies();
  const have = jar.get(BUYER_COOKIE)?.value;
  if (have && /^[0-9a-f]{32}$/.test(have)) return have;
  const sid = randomBytes(16).toString("hex");
  jar.set(BUYER_COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return sid;
}
