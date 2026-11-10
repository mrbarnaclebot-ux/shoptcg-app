import { and, asc, count, eq, gt, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import {
  catalogItem,
  listing,
  pricePoint,
  type CatalogItem,
} from "@/db/schema";
import { PartialPricesError } from "@/lib/pricing/errors";
import {
  providerByName,
  type PriceProvider,
  type Quote,
} from "@/lib/pricing/provider";

// Small chunks so one failing call loses little and progress is saved as we go.
const CHUNK = 25;
// Each failed chunk already spent the adapter retries; repeated 429s risk a PPT key ban.
const MAX_FAILED_CHUNKS = 3;

export interface SyncLimits {
  /** Credits per run: one per item priced, HISTORY_COST per history backfill. */
  maxCalls: number;
  /** History backfills per run, so a burst of new listings cannot eat the night. */
  maxBackfill: number;
}

function envLimits(): SyncLimits {
  const int = (v: string | undefined, d: number) =>
    Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : d;
  return {
    maxCalls: int(process.env.SYNC_MAX_CALLS, 5000),
    maxBackfill: int(process.env.SYNC_MAX_BACKFILL, 200),
  };
}

export interface SyncResult {
  items: number;
  written: number;
  unpriced: number;
  skipped: number;
  failed: number;
  /** Provider history calls made for items with too few points to chart. */
  backfilled: number;
}

function money(v: number | null) {
  return v === null ? null : v.toFixed(2);
}

async function writeQuotes(
  db: Db,
  date: string,
  source: string,
  quotes: Quote<CatalogItem>[],
) {
  if (!quotes.length) return;
  const rows = quotes.map((q) => ({
    catalogItemId: q.ref.id,
    date,
    marketUsd: q.marketUsd.toFixed(2),
    lowUsd: money(q.lowUsd),
    highUsd: money(q.highUsd),
    sampleSize: q.sampleSize === null ? null : Math.round(q.sampleSize),
    source,
  }));
  // Rerunning the same day overwrites today's row, so the job is idempotent.
  await db
    .insert(pricePoint)
    .values(rows)
    .onConflictDoUpdate({
      target: [pricePoint.catalogItemId, pricePoint.date, pricePoint.source],
      set: {
        marketUsd: sql`excluded.market_usd`,
        lowUsd: sql`excluded.low_usd`,
        highUsd: sql`excluded.high_usd`,
        sampleSize: sql`excluded.sample_size`,
      },
    });
}

async function syncProvider(
  db: Db,
  provider: PriceProvider,
  items: CatalogItem[],
  date: string,
  result: SyncResult,
) {
  const priced = new Set<string>();
  let failedInRow = 0;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    if (failedInRow >= MAX_FAILED_CHUNKS) {
      result.failed += items.length - i;
      console.error(
        `[sync] ${provider.name}: ${failedInRow} chunks failed in a row, stopping`,
      );
      return priced;
    }
    // A partial failure still carries the quotes that were paid for.
    let [quotes, failed] = [[] as Quote<CatalogItem>[], 0];
    try {
      quotes = await provider.getPrices(chunk);
    } catch (err) {
      if (err instanceof PartialPricesError)
        [quotes, failed] = [err.quotes, err.failed];
      else failed = chunk.length;
      console.error(`[sync] ${provider.name} chunk ${i / CHUNK} failed:`, err);
    }
    await writeQuotes(db, date, provider.name, quotes);
    for (const q of quotes) priced.add(q.ref.id);
    result.written += quotes.length;
    result.failed += failed;
    // No price means keep yesterday's row; never write a 0.
    result.unpriced += chunk.length - quotes.length - failed;
    failedInRow = failed ? failedInRow + 1 : 0;
  }
  return priced;
}

// The item page needs 3 points to draw a chart.
const MIN_POINTS = 3;
const BACKFILL_DAYS = 90;
// PPT bills 1 credit per card plus 1 for history (or for eBay on graded).
const HISTORY_COST = 2;

/** Items among these with fewer than MIN_POINTS rows of history. */
async function thinItems(db: Db, items: CatalogItem[]) {
  if (!items.length) return [];
  const rows = await db
    .select({ id: pricePoint.catalogItemId, n: count() })
    .from(pricePoint)
    .where(
      inArray(
        pricePoint.catalogItemId,
        items.map((i) => i.id),
      ),
    )
    .groupBy(pricePoint.catalogItemId);
  const n = new Map(rows.map((r) => [r.id, r.n]));
  return items.filter((i) => (n.get(i.id) ?? 0) < MIN_POINTS);
}

/**
 * One history call per thin item, so new listings get a chart on day one
 * instead of after three nightly runs. Takes at most `budget` items.
 * An item with no provider history is asked again each night until our own
 * daily rows reach MIN_POINTS, so at most twice more.
 */
async function backfillHistory(
  db: Db,
  provider: PriceProvider,
  items: CatalogItem[],
  budget: number,
) {
  let calls = 0;
  for (const item of (await thinItems(db, items)).slice(
    0,
    Math.max(0, budget),
  )) {
    calls++;
    try {
      const points = await provider.getHistory(item, BACKFILL_DAYS);
      if (!points.length) continue;
      await db
        .insert(pricePoint)
        .values(
          points.map((p) => ({
            catalogItemId: item.id,
            date: p.date,
            marketUsd: p.marketUsd.toFixed(2),
            source: provider.name,
          })),
        )
        .onConflictDoNothing();
    } catch (err) {
      // A chart can wait a night; prices already written stay written.
      console.error(
        `[sync] ${provider.name} history for ${item.id} failed:`,
        err,
      );
    }
  }
  return calls;
}

/** History calls still affordable: under maxBackfill and the credit budget. */
function backfillBudget(limits: SyncLimits, result: SyncResult) {
  const spent = result.items + result.backfilled * HISTORY_COST;
  return Math.min(
    limits.maxBackfill - result.backfilled,
    Math.floor((limits.maxCalls - spent) / HISTORY_COST),
  );
}

/**
 * Up to `limit` catalog items behind an active, in-stock listing. With `only`,
 * just those items, and just the ones `date` has no price for yet.
 */
function listedItems(db: Db, limit: number, date: string, only?: string[]) {
  // ponytail: least recently refreshed first, so a run that hits maxCalls rotates
  // through the rest tomorrow; per-store fairness if one store hogs the budget.
  const listed = db
    .select({ id: listing.catalogItemId })
    .from(listing)
    // Sold-out stock shows no price to buyers, so it costs no provider call.
    .where(and(eq(listing.active, true), gt(listing.qty, 0)));
  return db
    .select()
    .from(catalogItem)
    .where(
      and(
        inArray(catalogItem.id, listed),
        only && inArray(catalogItem.id, only),
        only &&
          sql`not exists (select 1 from ${pricePoint} where ${pricePoint.catalogItemId} = ${catalogItem.id} and ${pricePoint.date} = ${date})`,
      ),
    )
    .orderBy(
      sql`(select max(${pricePoint.date}) from ${pricePoint} where ${pricePoint.catalogItemId} = ${catalogItem.id}) asc nulls first`,
      asc(catalogItem.id),
    )
    .limit(limit);
}

/** Writes today's price_point for every catalog item an active, in-stock listing references. */
export async function syncPrices(
  db: Db,
  date = new Date().toISOString().slice(0, 10),
  pick: (name: string) => PriceProvider | null = providerByName,
  limits: SyncLimits = envLimits(),
  only?: string[],
): Promise<SyncResult> {
  const items = await listedItems(db, limits.maxCalls, date, only);
  const result: SyncResult = {
    items: items.length,
    written: 0,
    unpriced: 0,
    skipped: 0,
    failed: 0,
    backfilled: 0,
  };
  const byProvider = Map.groupBy(items, (it) => it.provider);
  for (const [name, group] of byProvider) {
    const provider = pick(name);
    if (!provider) {
      result.skipped += group.length;
      console.warn(
        `[sync] no adapter configured for ${name}, skipped ${group.length}`,
      );
      continue;
    }
    const priced = await syncProvider(db, provider, group, date, result);
    // Only items priced tonight: a failing provider gets no more calls, and an
    // item with no price has no history worth paying for either.
    const fresh = group.filter((it) => priced.has(it.id));
    const budget = backfillBudget(limits, result);
    result.backfilled += await backfillHistory(db, provider, fresh, budget);
  }
  return result;
}

// ponytail: one add or import prices at most this much straight away (about 4
// minutes of calls); the rest of a big import waits for the nightly run, which
// takes unpriced items first. Raise it if vendors import hundreds mid-show.
const ADD_LIMITS: SyncLimits = { maxCalls: 200, maxBackfill: 20 };

/**
 * Prices cards a vendor has just listed, with history for a chart, so they
 * don't sit unpriced until the nightly run. A card already priced today costs
 * nothing. Never throws: the listing is saved either way.
 */
export async function priceNewListings(db: Db, catalogItemIds: string[]) {
  if (!catalogItemIds.length) return;
  try {
    const res = await syncPrices(
      db,
      undefined,
      undefined,
      ADD_LIMITS,
      catalogItemIds,
    );
    if (res.items) console.log("[price-on-add]", res);
  } catch (err) {
    console.error("[price-on-add] failed", err);
  }
}

/** The newest day any card has a price for ("2026-11-10"), or null with none stored. */
export async function lastPriceDate(db: Db) {
  const [row] = await db
    .select({ date: sql<string | null>`max(${pricePoint.date})` })
    .from(pricePoint);
  return row?.date ?? null;
}
