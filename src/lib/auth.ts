import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { outboxPath, sendMagicLinkEmail } from "@/lib/email";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    // On in production by default: 5 magic-link hits a minute per IP. e2e signs
    // in far faster than that, and outboxPath refuses to run when deployed.
    rateLimit: { enabled: !outboxPath(process.env) },
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
