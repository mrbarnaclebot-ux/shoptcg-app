import { getDb } from "@/db";
import { csvResponse } from "@/lib/csv";
import { exportAllowed } from "@/lib/export-limit";
import { stockCsvRows } from "@/lib/listings";
import { localDate } from "@/lib/reports";
import { sellerTimeZone, storeOrNull } from "@/lib/session";

/** The whole stock, hidden items too, in the columns Import CSV reads. */
export async function GET() {
  const store = await storeOrNull();
  if (!store) return new Response(null, { status: 401 });
  if (!exportAllowed(store.id)) return new Response(null, { status: 429 });
  return csvResponse(
    `tcgmart-${store.slug}-inventory-${localDate(new Date(), await sellerTimeZone())}.csv`,
    await stockCsvRows(getDb(), store.id),
  );
}
