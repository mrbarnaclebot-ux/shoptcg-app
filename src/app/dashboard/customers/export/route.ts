import { getDb } from "@/db";
import { csvResponse } from "@/lib/csv";
import { promoRows } from "@/lib/customers";
import { exportAllowed } from "@/lib/export-limit";
import { localDate } from "@/lib/reports";
import { sellerTimeZone, storeOrNull } from "@/lib/session";

export async function GET() {
  const store = await storeOrNull();
  if (!store) return new Response(null, { status: 401 });
  if (!exportAllowed(store.id)) return new Response(null, { status: 429 });
  const timeZone = await sellerTimeZone();
  return csvResponse(
    `shoptcg-${store.slug}-promo-list-${localDate(new Date(), timeZone)}.csv`,
    await promoRows(getDb(), store.id, timeZone),
  );
}
