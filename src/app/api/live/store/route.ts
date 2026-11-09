import { getDb } from "@/db";
import { liveHub, subscribe } from "@/lib/live";
import { getCurrentUser } from "@/lib/session";
import { sseResponse } from "@/lib/sse";
import { getStoreByOwner } from "@/lib/stores";

/** The signed-in vendor's own store, live. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  const store = user && (await getStoreByOwner(getDb(), user.id));
  if (!store) return new Response(null, { status: 401 });
  return sseResponse(req.signal, { key: `u:${user.id}`, max: 5 }, (send) =>
    subscribe(liveHub(getDb()), `s:${store.id}`, (e) =>
      send({ t: e.t, r: e.r }),
    ),
  );
}
