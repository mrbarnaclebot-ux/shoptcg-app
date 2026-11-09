import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { request } from "@/db/schema";
import { readBuyerSid } from "@/lib/buyer-session";
import { liveHub, subscribe } from "@/lib/live";
import { sseResponse } from "@/lib/sse";
import { UUID } from "@/lib/storefront";

const notFound = () => new Response(null, { status: 404 });

/** One buyer's request, live; anyone but the phone that sent it gets a 404. */
export async function GET(
  req: Request,
  ctx: RouteContext<"/api/live/request/[id]">,
) {
  const { id } = await ctx.params;
  const sid = await readBuyerSid();
  if (!sid || !UUID.test(id)) return notFound();
  const [row] = await getDb()
    .select({ id: request.id })
    .from(request)
    .where(and(eq(request.id, id), eq(request.sessionId, sid)));
  if (!row) return notFound();
  return sseResponse(req.signal, { key: `b:${sid}`, max: 3 }, (send) =>
    subscribe(liveHub(getDb()), `r:${id}`, (e) => send({ t: e.t })),
  );
}
