import "server-only";
import { cacheLife } from "next/cache";
import { getDb } from "@/db";
import { historyPoints } from "@/lib/storefront";

/**
 * Chart points, cached for an hour. History moves once a day, and the date in
 * the key rolls it over without the sync process (a separate process that
 * cannot reach this cache) having to call revalidateTag.
 */
export async function priceHistory(
  catalogItemId: string,
  days: number,
  utcDate: string,
) {
  "use cache";
  cacheLife("hours");
  return historyPoints(getDb(), catalogItemId, days, utcDate);
}
