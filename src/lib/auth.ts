import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { sendMagicLinkEmail } from "@/lib/email";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    plugins: [
      magicLink({
        sendMagicLink: ({ email, url }) => sendMagicLinkEmail(email, url),
      }),
      // Must stay last: lets server actions set the session cookie.
      nextCookies(),
    ],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

// Lazy for the same reason as getDb: building must not open the database.
export function getAuth() {
  auth ??= createAuth();
  return auth;
}
