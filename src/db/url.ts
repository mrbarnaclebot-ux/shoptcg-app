import { isDeployed } from "../lib/deployed";

// Shared by the app and drizzle.config.ts. drizzle-kit does not set NODE_ENV,
// so a deployed environment is also detected through the Railway variables.
export function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  const deployed = process.env.NODE_ENV === "production" || isDeployed();
  if (!url && deployed) throw new Error("DATABASE_URL is required");
  return url;
}
