import { and, count, eq, gt } from "drizzle-orm";
import type { Db } from "@/db/open";
import { signInSend } from "@/db/schema";

// Better Auth's rate limiter runs only on HTTP requests to its router; the
// login server action calls auth.api directly, so the limit lives here.
export const LIMITS = {
  // Per email and address: a stranger's requests can't use up a vendor's own.
  email: { max: 3, windowMs: 10 * 60_000 },
  // Per email from anywhere, against mail bombing.
  emailAll: { max: 20, windowMs: 60 * 60_000 },
  ip: { max: 10, windowMs: 60 * 60_000 },
  join: { max: 10, windowMs: 60 * 60_000 },
  // Sign-in emails one code can trigger, so a leaked code can't spam addresses.
  code: { max: 5, windowMs: 24 * 60 * 60_000 },
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
 * `ip` null pools unknown clients (and e2e from one machine) together.
 * `ipBucket` false when the caller already counts the address, as /join does.
 */
export async function allowMagicLink(
  db: Db,
  email: string,
  ip: string | null,
  ipBucket = true,
) {
  const e = email.toLowerCase();
  const checks: [string, { max: number; windowMs: number }][] = [
    [`email:${e}:${ip ?? "-"}`, LIMITS.email],
    [`email:${e}`, LIMITS.emailAll],
  ];
  if (ip && ipBucket) checks.push([`ip:${ip}`, LIMITS.ip]);
  for (const [key, l] of checks)
    if (!(await under(db, key, l.max, l.windowMs))) return false;
  const keys = checks.map(([key]) => key);
  // ponytail: count-then-insert lets concurrent sends overshoot by a few, and
  // rows are never pruned; add a cleanup job if the table grows.
  await db.insert(signInSend).values(keys.map((key) => ({ key })));
  return true;
}

/** True and records it when this code may send another sign-in email. */
export async function allowCodeSend(db: Db, codeHash: string) {
  const key = `code:${codeHash}`;
  if (!(await under(db, key, LIMITS.code.max, LIMITS.code.windowMs)))
    return false;
  await db.insert(signInSend).values({ key });
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
