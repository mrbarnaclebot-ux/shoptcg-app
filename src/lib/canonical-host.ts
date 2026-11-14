type Env = Record<string, string | undefined>;

/**
 * Where a request on an old host (the Railway domain printed on table signs)
 * should go once the custom domain is live. Off while CANONICAL_HOST is unset.
 * Only GET and HEAD move: a form or ping posted from a page still open on the
 * old host would lose its body to a cross-origin redirect.
 */
export function canonicalRedirect(
  method: string,
  host: string | null,
  url: URL,
  env: Env = process.env,
): URL | null {
  const canonical = env.CANONICAL_HOST?.trim().toLowerCase();
  if (!canonical || !host || host.toLowerCase() === canonical) return null;
  if (method !== "GET" && method !== "HEAD") return null;
  // Railway's healthcheck calls the container on its own host.
  if (url.pathname === "/api/health") return null;
  // Next calls itself on localhost to render a server action's redirect (the
  // page after sign-in). Sending that off-host drops the new session cookie,
  // so the vendor got the sign-in page again. The edge never routes this host.
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)) return null;
  return new URL(`${url.pathname}${url.search}`, `https://${canonical}`);
}
