import { getDb } from "@/db";
import { optOut } from "@/lib/sales";

/** RFC 8058 one-click: mail clients POST here. A 200 either way, so tokens can't be probed. */
export async function POST(req: Request) {
  const body = await req.text();
  if (!body.includes("List-Unsubscribe=One-Click"))
    return new Response(null, { status: 400 });
  const token = new URL(req.url).searchParams.get("t") ?? "";
  await optOut(getDb(), token);
  return new Response(null, { status: 200 });
}
