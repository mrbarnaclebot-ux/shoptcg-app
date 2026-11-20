import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Test files run in parallel and several migrate the real Postgres (CI's DATABASE_URL).
// On an empty database they race on CREATE TABLE; migrating once here first makes theirs no-ops.
export default async function setup() {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const client = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  await client.end();
}
