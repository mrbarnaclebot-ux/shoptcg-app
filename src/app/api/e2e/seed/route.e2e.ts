import { getDb } from "@/db";
import { seedDemoStock } from "@/lib/demo-seed";
import { seedAllowed } from "@/lib/e2e-seed";
import { getCurrentUser } from "@/lib/session";
import { getStoreByOwner } from "@/lib/stores";

// Test-only: fills the signed-in vendor's own store with demo stock and price
// history, which the UI cannot create (prices come from the nightly sync).
// The .e2e.ts extension keeps it out of any build made without E2E_SEED=1
// (next.config.ts); the runtime check below is the second lock.
export async function POST() {
  if (!seedAllowed(process.env)) return new Response(null, { status: 404 });
  const user = await getCurrentUser();
  const store = user && (await getStoreByOwner(getDb(), user.id));
  if (!store) return new Response(null, { status: 401 });
  return Response.json(await seedDemoStock(getDb(), store.id));
}
