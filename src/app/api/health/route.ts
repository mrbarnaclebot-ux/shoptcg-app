import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";
import { store } from "@/db/schema";

// Railway's healthcheck: a deploy whose database is unreachable or unmigrated must fail, not go green.
export async function GET() {
  await connection(); // never prerender: must hit the live database
  try {
    await getDb().select({ one: sql`1` }).from(store).limit(1);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
