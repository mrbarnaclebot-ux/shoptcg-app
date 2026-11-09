import { getDb } from "@/db";
import { appUrl } from "@/lib/deployed";
import { optOut } from "@/lib/sales";

const tokenOf = (req: Request) => new URL(req.url).searchParams.get("t") ?? "";

/** A mail client that ignores List-Unsubscribe-Post opens this: the button page, no write. */
export function GET(req: Request) {
  const path = `/u/${encodeURIComponent(tokenOf(req))}`;
  return Response.redirect(new URL(path, appUrl()), 303);
}

/** RFC 8058 one-click: mail clients POST here. A 200 either way, so tokens can't be probed. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (form?.get("List-Unsubscribe") !== "One-Click")
    return new Response(null, { status: 400 });
  await optOut(getDb(), tokenOf(req));
  return new Response(null, { status: 200 });
}
