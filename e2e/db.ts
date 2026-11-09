import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { isDeployed } from "../src/lib/deployed";

export const hasDb = Boolean(process.env.DATABASE_URL);

/**
 * A sale last week, which the real flow can't make: created_at can't be set and
 * a sale can't be updated. Test-only: refuses to run against a deployed service.
 */
export async function addPastSale(slug: string, total: string, daysAgo = 7) {
  const sql = localDb();
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

function localDb() {
  const host = new URL(process.env.DATABASE_URL!).hostname;
  if (isDeployed() || !["localhost", "127.0.0.1"].includes(host))
    throw new Error("e2e/db.ts only runs against a local database");
  return postgres(process.env.DATABASE_URL!, { max: 1 });
}

/** A push row for a vendor: real subscribing needs a push service. */
export async function addPushRow(email: string, endpoint: string) {
  const sql = localDb();
  try {
    const [{ id }] = await sql`select id from "user" where email = ${email}`;
    await sql`insert into push_subscription (endpoint, user_id, p256dh, auth)
      values (${endpoint}, ${id}, 'k', 'a')`;
  } finally {
    await sql.end();
  }
}

export async function pushRowExists(endpoint: string) {
  const sql = localDb();
  try {
    const rows =
      await sql`select 1 from push_subscription where endpoint = ${endpoint}`;
    return rows.length > 0;
  } finally {
    await sql.end();
  }
}

export async function userExists(email: string) {
  const sql = localDb();
  try {
    const rows = await sql`select 1 from "user" where email = ${email}`;
    return rows.length > 0;
  } finally {
    await sql.end();
  }
}

/** Invite rows can't be expired through the UI before 14 days. */
export async function expireInvite(id: string) {
  const sql = localDb();
  try {
    await sql`update invite set expires_at = now() - interval '1 second' where id = ${id}`;
  } finally {
    await sql.end();
  }
}

export async function inviteRow(id: string) {
  const sql = localDb();
  try {
    const [row] =
      await sql`select used_at, revoked_at, reserved_email, redeemed_by from invite where id = ${id}`;
    return row;
  } finally {
    await sql.end();
  }
}

export async function invitesLabelled(label: string) {
  const sql = localDb();
  try {
    const [{ n }] =
      await sql`select count(*)::int n from invite where label = ${label}`;
    return n as number;
  } finally {
    await sql.end();
  }
}
