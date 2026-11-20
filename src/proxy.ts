import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth";
import { BUYER_COOKIE } from "@/lib/buyer-session";
import { canonicalRedirect } from "@/lib/canonical-host";
import { eventExists } from "@/lib/claim-events";
import { buyerRequest } from "@/lib/request-reads";
import { RESERVED_SLUGS, slugSchema } from "@/lib/slug";
import {
  getPublicStore,
  MISSING_HEADER,
  type Missing,
  publicItemExists,
  UUID,
} from "@/lib/storefront";
import { movedSlug } from "@/lib/stores";

// A page streams its first byte before notFound() can run, which locks in a
// 200 in production, so a real 404 has to be decided here: what is missing,
// or null. A store's old link answers with its current slug instead.
async function missing(
  req: NextRequest,
  slug: string,
  page?: string,
  id = "",
): Promise<Missing | { moved: string } | null> {
  if (!slugSchema.safeParse(slug).success) return "store";
  const db = getDb();
  const store = await getPublicStore(db, slug);
  if (!store) {
    const moved = await movedSlug(db, slug);
    return moved ? { moved } : "store";
  }
  // Link prefetches land here too, so this stays a single-row lookup.
  if (page === "item")
    return (await publicItemExists(db, store.id, id)) ? null : "item";
  if (page === "claim")
    return UUID.test(id) && (await eventExists(db, store.id, id))
      ? null
      : "claim";
  if (page !== "request") return null;
  // The waiting screen exists only for the phone that sent the request.
  const sid = req.cookies.get(BUYER_COOKIE)?.value;
  if (!sid || !UUID.test(id)) return "request";
  return (await buyerRequest(db, id, sid))?.slug === slug ? null : "request";
}

/** A real 404. The page says what was missing and, in a store, links back. */
function notFound(req: NextRequest, what?: string) {
  const headers = new Headers(req.headers);
  if (what) headers.set(MISSING_HEADER, what);
  else headers.delete(MISSING_HEADER);
  return NextResponse.rewrite(new URL("/_not-found", req.url), {
    request: { headers },
  });
}

// The paths that need a store or session check. Everything else only gets the
// canonical-host redirect, so a printed sign on the old domain still lands.
const CHECKED =
  /^\/(?:dashboard(?:\/.*)?|join\/[^/]+|[^/]+(?:\/(?:cart|list)|\/(?:item|request|claim)\/[^/]+)?)$/;

export async function proxy(req: NextRequest) {
  const moved = canonicalRedirect(
    req.method,
    req.headers.get("host"),
    req.nextUrl,
  );
  if (moved) return NextResponse.redirect(moved, 308);
  // Next answers a path it can't decode with a 500; catch it first.
  try {
    decodeURIComponent(req.nextUrl.pathname);
  } catch {
    if (req.nextUrl.pathname.startsWith("/join/"))
      return NextResponse.redirect(new URL("/join", req.url));
    return notFound(req);
  }
  if (req.nextUrl.pathname === "/login") return signedInToDashboard(req);
  if (!CHECKED.test(req.nextUrl.pathname)) return;
  const [slug, page, id] = req.nextUrl.pathname.slice(1).split("/");
  if (slug === "dashboard") {
    // Cookie presence only, to skip rendering for signed-out visitors.
    // requireUser() still validates the session on every dashboard request.
    if (!getSessionCookie(req))
      return NextResponse.redirect(new URL("/login", req.url));
    return;
  }
  // Top-level routes and files (favicon.ico) are not stores.
  if (RESERVED_SLUGS.has(slug) || slug.includes(".")) return;
  // The buyer's list became a cart; old links and bookmarks still land.
  if (page === "list" && id === undefined)
    return NextResponse.redirect(
      new URL(`/${slug}/cart${req.nextUrl.search}`, req.url),
      308,
    );
  const gone = await missing(req, slug, page, id);
  if (typeof gone === "object" && gone) {
    const to = req.nextUrl.clone();
    to.pathname = `/${gone.moved}${req.nextUrl.pathname.slice(slug.length + 1)}`;
    return NextResponse.redirect(to, 308);
  }
  if (gone) return notFound(req, gone === "store" ? gone : `${gone} ${slug}`);
}

/**
 * A vendor who is already signed in skips the sign-in form. The session is
 * checked, not just the cookie: an expired cookie would otherwise bounce
 * between here and the dashboard (requireUser sends it back to /login).
 */
async function signedInToDashboard(req: NextRequest) {
  if (!getSessionCookie(req)) return;
  const session = await getAuth()
    .api.getSession({ headers: req.headers })
    .catch(() => null);
  if (session) return NextResponse.redirect(new URL("/dashboard", req.url));
}

export const config = {
  // Everything but build assets, for the redirect; CHECKED narrows the rest.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
