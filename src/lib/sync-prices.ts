import { sql } from "drizzle-orm";
import type { Db } from "@/db/open";
import { catalogItem, pricePoint, type CatalogItem } from "@/db/schema";
import {
  providerByName,
  type PriceProvider,
  type Quote,
} from "@/lib/pricing/provider";

// Small chunks so one failing call loses little and progress is saved as we go.
const CHUNK = 25;
// Each failed chunk already spent the adapter retries; repeated 429s risk a PPT key ban.
const MAX_FAILED_CHUNKS = 3;

export interface SyncResult {
  items: number;
  written: number;
  unpriced: number;
  skipped: number;
  failed: number;
}

function money(v: number | null) {
  return v === null ? null : String(v);
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
    marketUsd: String(q.marketUsd),
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
    try {
      const quotes = await provider.getPrices(chunk);
      await writeQuotes(db, date, provider.name, quotes);
      result.written += quotes.length;
      // No price means keep yesterday's row; never write a 0.
      result.unpriced += chunk.length - quotes.length;
      failedInRow = 0;
    } catch (err) {
      failedInRow++;
      result.failed += chunk.length;
      console.error(`[sync] ${provider.name} chunk ${i / CHUNK} failed:`, err);
    }
  }
}

/** Writes today's price_point for every catalog item whose provider is configured. */
export async function syncPrices(
  db: Db,
  date = new Date().toISOString().slice(0, 10),
  pick: (name: string) => PriceProvider | null = providerByName,
): Promise<SyncResult> {
  // ponytail: syncs every cached item, including search-only ones; switch to items referenced by a listing in Phase 3.
  const items = await db.select().from(catalogItem);
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

/** Total failure: there was work, nothing was written, and calls failed. */
export function totalFailure(r: SyncResult) {
  return r.failed > 0 && r.written === 0;
}
