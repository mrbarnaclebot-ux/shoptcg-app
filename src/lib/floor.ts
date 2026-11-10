import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import { basket, visit, type BasketLine } from "@/db/schema";
import { basketTag } from "@/lib/basket-tag";
import { dayStart } from "@/lib/request-reads";
import { getPublicItems, type PublicStore } from "@/lib/storefront";

// "The floor": who is on a store's pages right now and what they are putting
// on a list before they send it. Buyers ping every 30 seconds while the page
// is in view (src/app/[slug]/presence.tsx).

/** A device counts as on the page for this long after its last ping. */
const ON_NOW = sql.raw(`interval '90 seconds'`);
/** A device seen again within this extends its visit; later starts a new one. */
const SAME_VISIT = sql.raw(`interval '30 minutes'`);
/** An unsent list stays on the vendor's screen this long after the buyer left. */
const BASKET_KEPT = sql.raw(`interval '30 minutes'`);
// Per store, not per IP: every buyer at a venue shares one address. The caps
// only stop a script from filling the table or the vendor's screen.
const MAX_BASKETS = 60;
const MAX_VISITS_A_DAY = 2000;

/** Marks the device as here now. True when this starts a new visit. */
export async function recordVisit(db: Db, storeId: string, deviceId: string) {
  const mine = and(eq(visit.storeId, storeId), eq(visit.deviceId, deviceId));
  const touched = await db
    .update(visit)
    .set({ lastSeen: sql`now()` })
    .where(and(mine, gt(visit.lastSeen, sql`now() - ${SAME_VISIT}`)))
    .returning({ id: visit.id });
  if (touched.length) return false;
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(visit)
    .where(
      and(
        eq(visit.storeId, storeId),
        gt(visit.firstSeen, sql`now() - interval '1 day'`),
      ),
    );
  if (n >= MAX_VISITS_A_DAY) return false;
  await db.insert(visit).values({ storeId, deviceId });
  return true;
}

/**
 * Mirrors the buyer's unsent list; an empty one removes it. True when what
 * the vendor would see changed, so pings that change nothing stay quiet.
 */
export async function syncBasket(
  db: Db,
  storeId: string,
  deviceId: string,
  lines: BasketLine[],
) {
  const mine = and(eq(basket.storeId, storeId), eq(basket.deviceId, deviceId));
  const [old] = await db
    .select({ lines: basket.lines })
    .from(basket)
    .where(and(mine, gt(basket.seenAt, sql`now() - ${BASKET_KEPT}`)));
  if (!lines.length) {
    await db.delete(basket).where(mine);
    return Boolean(old);
  }
  if (!old) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(basket)
      .where(
        and(
          eq(basket.storeId, storeId),
          gt(basket.seenAt, sql`now() - ${BASKET_KEPT}`),
        ),
      );
    if (n >= MAX_BASKETS) return false;
  }
  await db
    .insert(basket)
    .values({ storeId, deviceId, lines })
    .onConflictDoUpdate({
      target: [basket.storeId, basket.deviceId],
      set: { lines, seenAt: sql`now()` },
    });
  return JSON.stringify(old?.lines) !== JSON.stringify(lines);
}

export type FloorBasket = {
  tag: string;
  /** False once the buyer's page stopped pinging: they left or locked the phone. */
  here: boolean;
  total: number;
  lines: {
    id: string;
    name: string;
    qty: number;
    price: number | null;
    /** Other open lists holding the same item: a basket holds no stock. */
    others: number;
  }[];
};

/** What the vendor's dashboard shows: head counts and every open list. */
export async function floor(db: Db, s: PublicStore, timeZone: string) {
  const [[counts], rows] = await Promise.all([
    db
      .select({
        onNow: sql<number>`count(distinct ${visit.deviceId}) filter (where ${visit.lastSeen} > now() - ${ON_NOW})::int`,
        today: sql<number>`count(distinct ${visit.deviceId})::int`,
      })
      .from(visit)
      .where(
        and(
          eq(visit.storeId, s.id),
          sql`${visit.lastSeen} >= ${dayStart(timeZone)}`,
        ),
      ),
    db
      .select({
        deviceId: basket.deviceId,
        lines: basket.lines,
        here: sql<boolean>`${basket.seenAt} > now() - ${ON_NOW}`,
      })
      .from(basket)
      .where(
        and(
          eq(basket.storeId, s.id),
          gt(basket.seenAt, sql`now() - ${BASKET_KEPT}`),
        ),
      )
      .orderBy(sql`${basket.seenAt} desc`)
      .limit(MAX_BASKETS),
  ]);
  const ids = [...new Set(rows.flatMap((r) => r.lines.map((l) => l.id)))];
  // ponytail: getPublicItems reads 30 ids at most, so a floor with more distinct
  // items than that drops the rest from view; page it if tables get that busy.
  const items = new Map(
    (await getPublicItems(db, s, ids)).map((it) => [it.id, it]),
  );
  const holders = new Map<string, number>();
  for (const r of rows)
    for (const l of r.lines) holders.set(l.id, (holders.get(l.id) ?? 0) + 1);
  const baskets: FloorBasket[] = rows
    .map((r) => {
      const lines = r.lines.flatMap((l) => {
        const it = items.get(l.id);
        if (!it) return [];
        return {
          id: l.id,
          name: it.name,
          qty: l.qty,
          price: it.price,
          others: (holders.get(l.id) ?? 1) - 1,
        };
      });
      return {
        tag: basketTag(r.deviceId),
        here: r.here,
        total: lines.reduce((sum, l) => sum + (l.price ?? 0) * l.qty, 0),
        lines,
      };
    })
    .filter((b) => b.lines.length > 0);
  return { onNow: counts?.onNow ?? 0, today: counts?.today ?? 0, baskets };
}

/** Drops lists long gone and visits past the 30 days we keep buyer details. */
export async function sweepFloor(db: Db) {
  await db
    .delete(basket)
    .where(lt(basket.seenAt, sql`now() - interval '1 day'`));
  await db
    .delete(visit)
    .where(lt(visit.lastSeen, sql`now() - interval '30 days'`));
}
