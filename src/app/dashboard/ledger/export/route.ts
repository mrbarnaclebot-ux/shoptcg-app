import { getDb } from "@/db";
import { csvResponse } from "@/lib/csv";
import { exportAllowed } from "@/lib/export-limit";
import { ledgerCsvRows } from "@/lib/ledger";
import { parseRange } from "@/lib/reports";
import { sellerTimeZone, storeOrNull } from "@/lib/session";

/** Every stock move, sale and buy in the range, as the ledger page shows them. */
export async function GET(req: Request) {
  const store = await storeOrNull();
  if (!store) return new Response(null, { status: 401 });
  if (!exportAllowed(store.id)) return new Response(null, { status: 429 });
  const timeZone = await sellerTimeZone();
  const range = parseRange(
    Object.fromEntries(new URL(req.url).searchParams),
    timeZone,
    new Date(),
  );
  const days =
    range.from === range.to ? range.from : `${range.from}_${range.to}`;
  return csvResponse(
    `tcgmart-${store.slug}-ledger-${days}.csv`,
    await ledgerCsvRows(getDb(), store.id, range, timeZone),
  );
}
