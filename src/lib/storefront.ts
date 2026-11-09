import { and, asc, count, eq, gte, inArray, max } from "drizzle-orm";
import type { Db } from "@/db/open";
import { listing, pricePoint, store } from "@/db/schema";
import { altPrice } from "@/lib/fx";
import { listStock, type StockRow } from "@/lib/listings";
import { heldByListing, type Held } from "@/lib/request-reads";
import { safeImageUrl } from "@/lib/pricing/images";
import { underMarket, vendorPrice } from "@/lib/vendor-price";

// Everything here is read by buyers with no session. The store id from the
// slug lookup is in every where clause, so ids from other stores match nothing.

export type PublicStore = NonNullable<
  Awaited<ReturnType<typeof getPublicStore>>
>;

export async function getPublicStore(db: Db, slug: string) {
  const [row] = await db
    .select({
      id: store.id,
      slug: store.slug,
      name: store.name,
      logoUrl: store.logoUrl,
      isOpen: store.isOpen,
      tableLabel: store.tableLabel,
      secondCurrency: store.secondCurrency,
      fxRate: store.fxRate,
      nfcEnabled: store.nfcEnabled,
      priceRulePct: store.priceRulePct,
      rounding: store.rounding,
    })
    .from(store)
    .where(eq(store.slug, slug));
  if (!row) return null;
  const fxRate = row.fxRate === null ? null : Number(row.fxRate);
  return { ...row, fxRate, rounding: Number(row.rounding) };
}

export type Sort = "price-desc" | "price-asc" | "name" | "new";

export type PublicFilter = {
  type?: "raw" | "graded" | "sealed";
  langs?: ("en" | "ja" | "zh")[];
  q?: string;
  sort?: Sort;
};

function toPublic(s: PublicStore, held: Held) {
  return (r: StockRow) => {
    const price = vendorPrice(
      r.market,
      s.priceRulePct,
      s.rounding,
      r.overridePrice,
    );
    const hold = held.get(r.id);
    return {
      id: r.id,
      catalogItemId: r.catalogItemId,
      name: r.name,
      setName: r.setName,
      number: r.number,
      kind: r.kind,
      language: r.language,
      condition: r.condition,
      grader: r.grader,
      grade: r.grade,
      imageUrl: safeImageUrl(r.imageUrl),
      market: r.market,
      price,
      alt: altPrice(price, s.fxRate),
      underPct: underMarket(price, r.market),
      qty: r.qty,
      available: Math.max(0, r.qty - (hold?.qty ?? 0)),
      // Whole minutes until the hold lapses, at least 1; null when not held.
      holdMin: hold
        ? Math.max(1, Math.ceil((+hold.endsAt - Date.now()) / 60_000))
        : null,
    };
  };
}

export type PublicItem = ReturnType<ReturnType<typeof toPublic>>;

const BY: Record<Sort, (a: PublicItem, b: PublicItem) => number> = {
  // Unpriced items sort after priced ones either way.
  "price-desc": (a, b) => (b.price ?? -1) - (a.price ?? -1),
  "price-asc": (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
  name: (a, b) => a.name.localeCompare(b.name),
  // listStock already returns newest first, and sort is stable.
  new: () => 0,
};

/** Active stock as buyers see it: priced, filtered, sold out last. */
export async function listPublicStock(
  db: Db,
  s: PublicStore,
  f: PublicFilter = {},
) {
  const rows = await listStock(db, s.id, {
    kind: f.type,
    languages: f.langs,
    q: f.q,
  });
  const by = BY[f.sort ?? "price-desc"];
  const held = await heldByListing(db, s.id);
  return rows
    .map(toPublic(s, held))
    .sort((a, b) => Number(!a.qty) - Number(!b.qty) || by(a, b));
}

/** Header numbers: active items and the newest market price date. */
export async function storeSummary(db: Db, storeId: string) {
  const active = and(eq(listing.storeId, storeId), eq(listing.active, true));
  const [[{ items }], [{ updatedOn }]] = await Promise.all([
    db.select({ items: count() }).from(listing).where(active),
    db
      .select({ updatedOn: max(pricePoint.date) })
      .from(pricePoint)
      .where(
        inArray(
          pricePoint.catalogItemId,
          db.select({ id: listing.catalogItemId }).from(listing).where(active),
        ),
      ),
  ]);
  return { items, updatedOn };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One active listing of this store, or null (bad id, hidden, other store). */
export async function getPublicItem(db: Db, s: PublicStore, id: string) {
  if (!UUID.test(id)) return null;
  const [rows, held] = await Promise.all([
    listStock(db, s.id, { id }),
    heldByListing(db, s.id, [id]),
  ]);
  return rows[0] ? toPublic(s, held)(rows[0]) : null;
}

/** These listings as buyers see them, for the list review. */
export async function getPublicItems(db: Db, s: PublicStore, ids: string[]) {
  const ok = ids.filter((id) => UUID.test(id)).slice(0, 30);
  if (!ok.length) return [];
  const [rows, held] = await Promise.all([
    listStock(db, s.id, { ids: ok }),
    heldByListing(db, s.id, ok),
  ]);
  return rows.map(toPublic(s, held));
}

/** Daily market points for the chart, oldest first. */
export async function historyPoints(
  db: Db,
  catalogItemId: string,
  days: number,
  today: string,
) {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const rows = await db
    .select({ date: pricePoint.date, market: pricePoint.marketUsd })
    .from(pricePoint)
    .where(
      and(
        eq(pricePoint.catalogItemId, catalogItemId),
        gte(pricePoint.date, from),
      ),
    )
    .orderBy(asc(pricePoint.date));
  // ponytail: two sources on one day both plot; pick one if a second provider lands.
  return rows.map((r) => ({ date: r.date, market: Number(r.market) }));
}
