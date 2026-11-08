import "server-only";
import { openDb, type Db } from "./open";

export type { Db };

// Next bundles route handlers and server actions separately, so a module-level
// singleton would give each its own PGlite copy with diverging data.
const g = globalThis as { shoptcgDb?: Db };

// Lazy so `next build` workers never open the PGlite directory concurrently.
export function getDb(): Db {
  g.shoptcgDb ??= openDb();
  return g.shoptcgDb;
}
