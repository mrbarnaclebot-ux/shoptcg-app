import { NextResponse } from "next/server";
import { PREVIEW_COOKIE } from "@/lib/preview-cookie";

/** Ends preview on this browser and returns to the dashboard. */
export function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.delete(PREVIEW_COOKIE);
  return res;
}
