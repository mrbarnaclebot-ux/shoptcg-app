import { getDb } from "@/db";
import { readBuyerSid } from "@/lib/buyer-session";
import { publicEvent, roomState } from "@/lib/claim-events";
import { UUID } from "@/lib/storefront";

/** A claim event as its buyers see it, polled every few seconds while it runs. */
export async function GET(_req: Request, ctx: RouteContext<"/api/claim/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  const db = getDb();
  const e = await publicEvent(db, id);
  if (!e) return new Response(null, { status: 404 });
  return Response.json(await roomState(db, e, await readBuyerSid()), {
    headers: { "cache-control": "no-store" },
  });
}
