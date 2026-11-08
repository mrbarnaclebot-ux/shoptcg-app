import { desc, gt, sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import { catalogItem, pricePoint, type CatalogItem } from "@/db/schema";
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
  /** Items priced per run; each costs at most one provider call. */
  maxCalls: number;
  /** Only items a search returned within this many days. */
  seenDays: number;
}

function envLimits(): SyncLimits {
  const int = (v: string | undefined, d: number) =>
    Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : d;
  return {
    maxCalls: int(process.env.SYNC_MAX_CALLS, 5000),
    seenDays: int(process.env.SYNC_SEEN_DAYS, 30),
  };
}

export interface SyncResult {
  items: number;
  written: number;
  unpriced: number;
  skipped: number;
  failed: number;
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
  let failedInRow = 0;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    if (failedInRow >= MAX_FAILED_CHUNKS) {
      result.failed += items.length - i;
      console.error(
        `[sync] ${provider.name}: ${failedInRow} chunks failed in a row, stopping`,
      );
      return;
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
    result.written += quotes.length;
    result.failed += failed;
    // No price means keep yesterday's row; never write a 0.
    result.unpriced += chunk.length - quotes.length - failed;
    failedInRow = failed ? failedInRow + 1 : 0;
  }
}

/** Writes today's price_point for recently searched items whose provider is configured. */
export async function syncPrices(
  db: Db,
  date = new Date().toISOString().slice(0, 10),
  pick: (name: string) => PriceProvider | null = providerByName,
  limits: SyncLimits = envLimits(),
): Promise<SyncResult> {
  // ponytail: prices recently searched items, newest first, up to maxCalls; switch to items referenced by a listing in Phase 3.
  const since = new Date(Date.now() - limits.seenDays * 86_400_000);
  const items = await db
    .select()
    .from(catalogItem)
    .where(gt(catalogItem.lastSeenAt, since))
    .orderBy(desc(catalogItem.lastSeenAt))
    .limit(limits.maxCalls);
  const result: SyncResult = {
    items: items.length,
    written: 0,
    unpriced: 0,
    skipped: 0,
    failed: 0,
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
    await syncProvider(db, provider, group, date, result);
  }
  return result;
}
