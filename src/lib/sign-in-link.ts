import "server-only";
import { after } from "next/server";
import { getAuth } from "@/lib/auth";

/**
 * Emails an invite link after responding, so the response time can't show
 * whether the address has an account. The link proves the inbox, makes the
 * account (claiming the invite reserved for it) and lands on /welcome to choose
 * a password. A failure is logged, not shown.
 */
export function sendInviteLink(email: string, headers: Headers) {
  after(() =>
    getAuth()
      .api.signInMagicLink({
        body: {
          email,
          callbackURL: "/welcome",
          errorCallbackURL: "/join?link=expired",
        },
        headers,
      })
      .then(
        () => {},
        (err: unknown) => {
          const why = err instanceof Error ? err.message : "unknown";
          console.error(
            "[invite] link failed",
            why.replace(/\S+@\S+/g, "<email>"),
          );
        },
      ),
  );
}

/** Emails a link to set a new password; same quiet failure as above. */
export function sendResetLink(email: string, headers: Headers) {
  after(() =>
    getAuth()
      .api.requestPasswordReset({ body: { email }, headers })
      .then(
        () => {},
        (err: unknown) => {
          const why = err instanceof Error ? err.message : "unknown";
          console.error(
            "[reset] link failed",
            why.replace(/\S+@\S+/g, "<email>"),
          );
        },
      ),
  );
}
