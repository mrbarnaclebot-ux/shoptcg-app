import { getSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { getDb } from "@/db";
import { DEVICE_ID } from "@/lib/basket-tag";
import { appUrl } from "@/lib/deployed";
import { recordVisit, syncBasket } from "@/lib/floor";
import { notifyLive } from "@/lib/live";
import { MAX_LINES } from "@/lib/requests";
import { storeOrNull } from "@/lib/session";
import { slugSchema } from "@/lib/slug";
import { getPublicStore, removedItems } from "@/lib/storefront";

const MAX_BODY = 4096;

const schema = z.object({
  slug: slugSchema,
  device: z.string().regex(DEVICE_ID),
  lines: z
    .array(z.object({ id: z.uuid(), qty: z.number().int().min(1).max(99) }))
    .max(MAX_LINES),
});

const answer = (status: number) => new Response(null, { status });

/**
 * A buyer's page says "still here" and sends its unsent list. Anonymous: the
 * device id is random and per store, and nothing here names the buyer.
 */
export async function POST(req: Request) {
  if (req.headers.get("origin") !== appUrl().origin) return answer(403);
  const text = await req.text();
  if (text.length > MAX_BODY) return answer(413);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return answer(400);
  }
  const body = schema.safeParse(json);
  if (!body.success) return answer(400);
  const db = getDb();
  const store = await getPublicStore(db, body.data.slug);
  if (!store) return answer(404);
  // A vendor looking at their own page, preview or not, is not a visitor.
  if (getSessionCookie(req) && (await storeOrNull())?.id === store.id)
    return answer(204);
  const { device } = body.data;
  // What the vendor removed comes back so the phone drops it and says so.
  const removed = await removedItems(
    db,
    store.id,
    body.data.lines.map((l) => l.id),
  );
  const lines = body.data.lines.filter(
    (l) => !removed.some((r) => r.id === l.id),
  );
  const arrived = await recordVisit(db, store.id, device);
  // Lists only exist while buyers can send them.
  const changed = await syncBasket(
    db,
    store.id,
    device,
    store.state === "open" ? lines : [],
  );
  if (arrived || changed)
    await notifyLive(db, { s: store.id, r: "", t: "floor" });
  return removed.length ? Response.json({ removed }) : answer(204);
}
