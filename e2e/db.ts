import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { isDeployed } from "../src/lib/deployed";

export const hasDb = Boolean(process.env.DATABASE_URL);

/**
 * A sale last week, which the real flow can't make: created_at can't be set and
 * a sale can't be updated. Test-only: refuses to run against a deployed service.
 */
export async function addPastSale(slug: string, total: string, daysAgo = 7) {
  if (isDeployed()) throw new Error("e2e/db.ts refuses to run when deployed");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const at = new Date(Date.now() - daysAgo * 86_400_000);
    const [{ id: storeId }] =
      await sql`select id from store where slug = ${slug}`;
    const [{ id: requestId }] = await sql`
      insert into request (store_id, code, status, terms_version, session_id, created_at, expires_at)
      values (${storeId}, '2222', 'confirmed', '1', ${randomUUID()}, ${new Date(at.getTime() - 1000)}, ${at})
      returning id`;
    const [{ id: saleId }] = await sql`
      insert into sale (store_id, request_id, seq, receipt_no, store_name, buyer_name, buyer_email, subtotal, total, payment_method, created_at)
      values (${storeId}, ${requestId}, 9000, 'R-9000', 'E2E Cards', 'Past Buyer', 'past@example.test', ${total}, ${total}, 'cash', ${at})
      returning id`;
    await sql`
      insert into sale_line (sale_id, line_no, listing_id, name, language, qty, unit_price, quoted_price)
      values (${saleId}, 1, ${randomUUID()}, 'Old stock', 'en', 1, ${total}, ${total})`;
    return at.toISOString().slice(0, 10);
  } finally {
    await sql.end();
  }
}
