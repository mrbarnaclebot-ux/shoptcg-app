import "server-only";
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Next bundles route handlers and server actions separately, so a module-level
// singleton would give each its own PGlite copy with diverging data.
const g = globalThis as { shoptcgDb?: Db };

function openPglite(): Db {
  // PGlite creates only the leaf directory, not its parents.
  mkdirSync(".data", { recursive: true });
  return drizzlePglite(new PGlite(".data/pglite"), { schema });
}

// Lazy so `next build` workers never open the PGlite directory concurrently.
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  // ponytail: PGlite fallback is single-process and dev-only; production always sets DATABASE_URL.
  g.shoptcgDb ??= url
    ? drizzlePostgres(postgres(url), { schema })
    : openPglite();
  return g.shoptcgDb;
}
