import { mkdirSync } from "node:fs";
import { defineConfig } from "drizzle-kit";
import { databaseUrl } from "./src/db/url";

const url = databaseUrl();
// PGlite creates only the leaf directory, not its parents.
if (!url) mkdirSync(".data", { recursive: true });

// Mirrors src/db/index.ts: real Postgres when DATABASE_URL is set, local PGlite otherwise.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  ...(url
    ? { dbCredentials: { url } }
    : { driver: "pglite", dbCredentials: { url: "./.data/pglite" } }),
});
