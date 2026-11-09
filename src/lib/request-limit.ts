import { createHmac } from "node:crypto";
import { and, count, eq, gt, sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import { request } from "@/db/schema";

// Counts request rows themselves, so there is no limiter table to prune.
export const REQUEST_LIMITS = {
  session: { max: 3, windowMs: 10 * 60_000 },
  pendingPerStore: 2,
  // Venue WiFi puts a whole hall behind one NAT address.
  ip: { max: 30, windowMs: 10 * 60_000 },
} as const;

/** Raw IPs never reach the database; the HMAC still lets one address be counted. */
export function ipHash(ip: string, secret: string) {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

async function countWhere(db: Db, where: ReturnType<typeof and>) {
  const [{ n }] = await db.select({ n: count() }).from(request).where(where);
  return n;
}

const since = (ms: number) => gt(request.createdAt, new Date(Date.now() - ms));

/**
 * True when this phone or address must wait before sending another request.
 * ponytail: count-then-insert lets two simultaneous sends overshoot by one; fine for spam control.
 */
export async function requestLimited(
  db: Db,
  k: { sessionId: string; storeId: string; ipHash: string | null },
) {
  const { session, ip, pendingPerStore } = REQUEST_LIMITS;
  const bySession = eq(request.sessionId, k.sessionId);
  const checks = [
    countWhere(db, and(bySession, since(session.windowMs))).then(
      (n) => n >= session.max,
    ),
    countWhere(
      db,
      and(
        bySession,
        eq(request.storeId, k.storeId),
        eq(request.status, "pending"),
        sql`${request.expiresAt} > now()`,
      ),
    ).then((n) => n >= pendingPerStore),
  ];
  if (k.ipHash)
    checks.push(
      countWhere(
        db,
        and(eq(request.ipHash, k.ipHash), since(ip.windowMs)),
      ).then((n) => n >= ip.max),
    );
  return (await Promise.all(checks)).some(Boolean);
}
