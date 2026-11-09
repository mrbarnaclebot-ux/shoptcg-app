import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { isAdminEmail } from "@/lib/admin";
import { outboxPath, sendMagicLinkEmail } from "@/lib/email";
import { claimInvite, markRedeemed } from "@/lib/invites";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    // On in production by default: 5 magic-link hits a minute per IP. e2e signs
    // in far faster than that, and outboxPath refuses to run when deployed.
    rateLimit: { enabled: !outboxPath(process.env) },
    // Sends go through our own limits in server actions; auth.api still works.
    disabledPaths: ["/sign-in/magic-link"],
    databaseHooks: {
      user: {
        create: {
          // The one place an account is made, whichever route asked for it.
          before: async (u) => {
            if (isAdminEmail(u.email) || (await claimInvite(getDb(), u.email)))
              return;
            throw new APIError("FORBIDDEN", {
              code: "INVITE_REQUIRED",
              message: "An invite is required",
            });
          },
          after: async (u) => {
            // The account exists by now, so this must not fail the sign-in.
            await markRedeemed(getDb(), u.id, u.email).catch((err: unknown) =>
              console.error(
                "[invite] redeem not recorded",
                (err as Error).name,
              ),
            );
          },
        },
      },
    },
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
