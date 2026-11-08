// Nightly price sync. Railway cron runs `pnpm sync:prices` at 06:00 UTC.
import { openDb } from "@/db/open";
import { syncPrices, totalFailure } from "@/lib/sync-prices";

async function main() {
  // Local runs read .env like Next does; deployed env vars take precedence.
  try {
    process.loadEnvFile();
  } catch {}
  const started = Date.now();
  const result = await syncPrices(openDb());
  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`[sync] done in ${seconds}s`, result);
  return totalFailure(result) ? 1 : 0;
}

// Explicit exit: an open Postgres pool would otherwise keep the cron container alive.
main().then(
  (code) => process.exit(code),
  (err) => {
    console.error("[sync] crashed:", err);
    process.exit(1);
  },
);
