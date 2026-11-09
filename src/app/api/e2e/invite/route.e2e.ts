import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { invite } from "@/db/schema";
import { seedAllowed } from "@/lib/e2e-seed";
import { createInvite, hashCode } from "@/lib/invites";

// Test-only: mints a real invite so e2e vendors join the way a real one does.
// Same two locks as the seed route: the .e2e.ts extension and this check.
export async function POST() {
  if (!seedAllowed(process.env)) return new Response(null, { status: 404 });
  const db = getDb();
  const code = await createInvite(db, "e2e");
  const [row] = await db
    .select({ id: invite.id })
    .from(invite)
    .where(eq(invite.codeHash, hashCode(code)));
  return Response.json({ code, id: row.id });
}
