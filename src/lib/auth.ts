import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { isAdminEmail } from "@/lib/admin";
import { appUrl } from "@/lib/deployed";
import { outboxPath, sendInviteEmail, sendResetEmail } from "@/lib/email";
import { claimInvite, markRedeemed } from "@/lib/invites";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    // On in production by default: 5 magic-link hits a minute per IP. e2e signs
    // in far faster than that, and outboxPath refuses to run when deployed.
    rateLimit: { enabled: !outboxPath(process.env) },
    // Every sign-in, reset and invite goes through a server action with our own
    // limits (src/lib/sign-in-limit.ts); auth.api still works, HTTP doesn't.
    disabledPaths: [
      "/sign-in/magic-link",
      "/sign-in/email",
      "/sign-up/email",
      "/request-password-reset",
      "/reset-password",
      "/change-password",
    ],
    // Vendors live on their phones: stay signed in for 30 days of no use,
    // refreshed at most daily while they keep using it.
    session: { expiresIn: 30 * 86_400, updateAge: 86_400 },
    emailAndPassword: {
      enabled: true,
      // Accounts are only made by an invite link (magic link + the hook below).
      disableSignUp: true,
      minPasswordLength: 8,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 3600,
      // The email links straight to our page, not Better Auth's redirect route.
      sendResetPassword: ({ user, token }) => {
        const url = new URL("/login/reset", appUrl());
        url.searchParams.set("token", token);
        return sendResetEmail(user.email, url.toString());
      },
    },
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
      // Only invites use email links now: one click proves the inbox, makes
      // the account and lands on /welcome to choose a password.
      magicLink({
        expiresIn: 48 * 3600,
        sendMagicLink: ({ email, url }) => sendInviteEmail(email, url),
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
