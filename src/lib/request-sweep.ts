import { and, lte, ne, or, sql, isNotNull, eq } from "drizzle-orm";
import type { Db } from "@/db/open";
import { request } from "@/db/schema";
import { sweepFloor } from "@/lib/floor";
import { notifyLive } from "@/lib/live";

export const SWEEP_MS = 60_000;
const PURGE_DAYS = 30;

/**
 * Flips lapsed holds to expired (so open screens hear about it) and clears
 * buyer details from unsold requests after 30 days. Idempotent: a second
 * instance running it only repeats no-op updates.
 */
export async function sweepRequests(db: Db) {
  const expired = await db.transaction(async (tx) => {
    const rows = await tx
      .update(request)
      .set({ status: "expired" })
      .where(
        and(eq(request.status, "pending"), lte(request.expiresAt, sql`now()`)),
      )
      .returning({ id: request.id, storeId: request.storeId });
    for (const r of rows)
      await notifyLive(tx as Db, { s: r.storeId, r: r.id, t: "expired" });
    return rows.length;
  });
  const purged = await db
    .update(request)
    .set({ buyerName: null, buyerEmail: null, ipHash: null })
    .where(
      and(
        ne(request.status, "confirmed"),
        lte(
          request.createdAt,
          sql`now() - make_interval(days => ${PURGE_DAYS})`,
        ),
        or(
          isNotNull(request.buyerName),
          isNotNull(request.buyerEmail),
          isNotNull(request.ipHash),
        ),
      ),
    )
    .returning({ id: request.id });
  await sweepFloor(db);
  return { expired, purged: purged.length };
}

const g = globalThis as { shoptcgSweeper?: ReturnType<typeof setInterval> };

/** One timer per process; unref so it never keeps a script alive. */
export function startSweeper(db: Db) {
  if (g.shoptcgSweeper) return;
  g.shoptcgSweeper = setInterval(() => {
    sweepRequests(db).catch((err) => console.error("[sweep] failed", err));
  }, SWEEP_MS);
  g.shoptcgSweeper.unref();
}
