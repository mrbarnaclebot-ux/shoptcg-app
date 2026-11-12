import { getDb } from "@/db";
import { buyCsvRows } from "@/lib/buys";
import { csvResponse } from "@/lib/csv";
import { exportAllowed } from "@/lib/export-limit";
import { parseRange } from "@/lib/reports";
import { sellerTimeZone, storeOrNull } from "@/lib/session";

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
    `shoptcg-${store.slug}-buys-${days}.csv`,
    await buyCsvRows(getDb(), store.id, range, timeZone),
  );
}
