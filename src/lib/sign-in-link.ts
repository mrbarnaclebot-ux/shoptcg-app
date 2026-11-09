import "server-only";
import { after } from "next/server";
import { getAuth } from "@/lib/auth";

/**
 * Emails a sign-in link after responding, so the response time can't show
 * whether the address has an account. A failure is logged, not shown.
 */
export function sendSignInLink(email: string, headers: Headers) {
  after(() =>
    getAuth()
      .api.signInMagicLink({
        body: {
          email,
          callbackURL: "/dashboard",
          errorCallbackURL: "/login?link=expired",
        },
        headers,
      })
      .then(
        () => {},
        (err: unknown) => {
          const why = err instanceof Error ? err.message : "unknown";
          console.error(
            "[login] magic link failed",
            why.replace(/\S+@\S+/g, "<email>"),
          );
        },
      ),
  );
}
