// Shared by the app and drizzle.config.ts. drizzle-kit does not set NODE_ENV,
// so a deployed environment is also detected through RAILWAY_ENVIRONMENT.
export function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  const deployed =
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.RAILWAY_ENVIRONMENT);
  if (!url && deployed) throw new Error("DATABASE_URL is required");
  return url;
}
