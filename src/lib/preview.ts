import "server-only";
import { cookies } from "next/headers";
import { PREVIEW_COOKIE } from "@/lib/preview-cookie";
import { storeOrNull } from "@/lib/session";

/**
 * Preview lets a vendor see their store as buyers would with it open.
 * True when the visitor is this store's owner and has preview on.
 */
export async function previewing(slug: string) {
  // Buyers have no cookie, so they never pay for the session lookup.
  if (!(await cookies()).has(PREVIEW_COOKIE)) return false;
  return (await storeOrNull())?.slug === slug;
}
