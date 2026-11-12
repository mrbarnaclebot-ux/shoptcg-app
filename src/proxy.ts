import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { BUYER_COOKIE } from "@/lib/buyer-session";
import { buyerRequest } from "@/lib/request-reads";
import { RESERVED_SLUGS, slugSchema } from "@/lib/slug";
import { getPublicItem, getPublicStore, UUID } from "@/lib/storefront";

// A page streams its first byte before notFound() can run, which locks in a
// 200 in production, so a real 404 has to be decided here.
async function missing(req: NextRequest, slug: string, page?: string, id = "") {
  if (!slugSchema.safeParse(slug).success) return true;
  const db = getDb();
  const store = await getPublicStore(db, slug);
  if (!store) return true;
  if (page === "item") return !(await getPublicItem(db, store, id));
  if (page !== "request") return false;
  // The waiting screen exists only for the phone that sent the request.
  const sid = req.cookies.get(BUYER_COOKIE)?.value;
  if (!sid || !UUID.test(id)) return true;
  return (await buyerRequest(db, id, sid))?.slug !== slug;
}

export async function proxy(req: NextRequest) {
  // Next answers a path it can't decode with a 500; catch it first.
  try {
    decodeURIComponent(req.nextUrl.pathname);
  } catch {
    if (req.nextUrl.pathname.startsWith("/join/"))
      return NextResponse.redirect(new URL("/join", req.url));
    return NextResponse.rewrite(new URL("/_not-found", req.url));
  }
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
  if (await missing(req, slug, page, id))
    return NextResponse.rewrite(new URL("/_not-found", req.url));
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/:slug",
    "/:slug/cart",
    "/:slug/list",
    "/:slug/item/:id",
    "/:slug/request/:id",
    "/join/:code",
  ],
};
