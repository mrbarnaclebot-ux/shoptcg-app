import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { databaseUrl } from "./url";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Free of "server-only" so scripts (the nightly price sync) can open the same database.
export function openDb(): Db {
  const url = databaseUrl();
  if (url) return drizzlePostgres(postgres(url), { schema });
  // ponytail: PGlite fallback is single-process and dev-only; databaseUrl() refuses it when deployed.
  // PGlite creates only the leaf directory, not its parents.
  mkdirSync(".data", { recursive: true });
  return drizzlePglite(new PGlite(".data/pglite"), { schema });
}

// Next bundles route handlers, server actions and instrumentation separately,
// so a module-level singleton would give each its own PGlite copy.
const g = globalThis as { shoptcgDb?: Db };

/** The process-wide database, opened lazily so build workers never touch PGlite. */
export function sharedDb(): Db {
  g.shoptcgDb ??= openDb();
  return g.shoptcgDb;
}
