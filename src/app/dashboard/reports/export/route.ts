import { getDb } from "@/db";
import { csvResponse } from "@/lib/csv";
import { exportAllowed } from "@/lib/export-limit";
import { parseRange, reportCsvRows } from "@/lib/reports";
import { sellerTimeZone, storeOrNull } from "@/lib/session";

export async function GET(req: Request) {
  const store = await storeOrNull();
  if (!store) return new Response(null, { status: 401 });
  if (!exportAllowed(store.id)) return new Response(null, { status: 429 });
  const range = parseRange(
    Object.fromEntries(new URL(req.url).searchParams),
    await sellerTimeZone(),
    new Date(),
  );
  const days =
    range.from === range.to ? range.from : `${range.from}_${range.to}`;
  return csvResponse(
    `tcgmart-${store.slug}-${days}.csv`,
    await reportCsvRows(getDb(), store.id, range),
  );
}
