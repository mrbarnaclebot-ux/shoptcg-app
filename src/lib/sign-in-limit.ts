import { and, count, eq, gt } from "drizzle-orm";
import type { Db } from "@/db/open";
import { signInSend } from "@/db/schema";

// Better Auth's rate limiter runs only on HTTP requests to its router; the
// login server action calls auth.api directly, so the limit lives here.
export const LIMITS = {
  email: { max: 3, windowMs: 10 * 60_000 },
  ip: { max: 10, windowMs: 60 * 60_000 },
  join: { max: 10, windowMs: 60 * 60_000 },
} as const;

async function under(db: Db, key: string, max: number, windowMs: number) {
  const since = new Date(Date.now() - windowMs);
  const [{ n }] = await db
    .select({ n: count() })
    .from(signInSend)
    .where(and(eq(signInSend.key, key), gt(signInSend.at, since)));
  return n < max;
}

/**
 * True and records the attempt when this email and IP may get another link.
 * `ip` null skips the IP check (unknown client, or e2e from one machine).
 */
export async function allowMagicLink(db: Db, email: string, ip: string | null) {
  const keys = [`email:${email.toLowerCase()}`];
  if (!(await under(db, keys[0], LIMITS.email.max, LIMITS.email.windowMs)))
    return false;
  if (ip) {
    keys.push(`ip:${ip}`);
    if (!(await under(db, keys[1], LIMITS.ip.max, LIMITS.ip.windowMs)))
      return false;
  }
  // ponytail: count-then-insert lets concurrent sends overshoot by a few, and
  // rows are never pruned; add a cleanup job if the table grows.
  await db.insert(signInSend).values(keys.map((key) => ({ key })));
  return true;
}

/** Every invite code attempt counts, so codes can't be guessed from one address. */
export async function allowJoin(db: Db, ip: string | null) {
  if (!ip) return true;
  const key = `join:${ip}`;
  if (!(await under(db, key, LIMITS.join.max, LIMITS.join.windowMs)))
    return false;
  await db.insert(signInSend).values({ key });
  return true;
}

/**
 * x-real-ip is set by Railway's proxy. The first x-forwarded-for hop is
 * client-supplied and spoofable, so fall back to the last hop (added by the proxy).
 */
export function clientIp(h: Headers) {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const last = h.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return last || null;
}
