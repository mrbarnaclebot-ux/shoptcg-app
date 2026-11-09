import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { RESERVED_SLUGS, slugSchema } from "@/lib/slug";
import { getPublicItem, getPublicStore } from "@/lib/storefront";

// A page streams its first byte before notFound() can run, which locks in a
// 200 in production, so a real 404 has to be decided here.
async function missing(slug: string, itemId?: string) {
  if (!slugSchema.safeParse(slug).success) return true;
  const db = getDb();
  const store = await getPublicStore(db, slug);
  if (!store) return true;
  return itemId ? !(await getPublicItem(db, store, itemId)) : false;
}

export async function proxy(req: NextRequest) {
  const [slug, , itemId] = req.nextUrl.pathname.slice(1).split("/");
  if (slug === "dashboard") {
    // Cookie presence only, to skip rendering for signed-out visitors.
    // requireUser() still validates the session on every dashboard request.
    if (!getSessionCookie(req))
      return NextResponse.redirect(new URL("/login", req.url));
    return;
  }
  // Top-level routes and files (favicon.ico) are not stores.
  if (RESERVED_SLUGS.has(slug) || slug.includes(".")) return;
  if (await missing(slug, itemId))
    return NextResponse.rewrite(new URL("/_not-found", req.url));
}

export const config = {
  matcher: ["/dashboard/:path*", "/:slug", "/:slug/item/:id"],
};
