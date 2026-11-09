import { getDb } from "@/db";
import { seedDemoStock } from "@/lib/demo-seed";
import { getCurrentUser } from "@/lib/session";
import { getStoreByOwner } from "@/lib/stores";

// Test-only: fills the signed-in vendor's own store with demo stock and price
// history, which the UI cannot create (prices come from the nightly sync).
// 404 unless the server was started with E2E_SEED=1 (playwright.config.ts).
export async function POST() {
  if (process.env.E2E_SEED !== "1") return new Response(null, { status: 404 });
  const user = await getCurrentUser();
  const store = user && (await getStoreByOwner(getDb(), user.id));
  if (!store) return new Response(null, { status: 401 });
  return Response.json(await seedDemoStock(getDb(), store.id));
}
