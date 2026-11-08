import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Cookie presence only, to skip rendering for signed-out visitors.
// requireUser() still validates the session on every dashboard request.
export function proxy(req: NextRequest) {
  if (!getSessionCookie(req))
    return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/dashboard/:path*"] };
