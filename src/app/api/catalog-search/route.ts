import { z } from "zod";
import { getDb } from "@/db";
import {
  MISSES_PER_HOUR,
  missLimit,
  searchCached,
  searchFresh,
  withMarket,
  type SearchFailure,
} from "@/lib/catalog";
import { appUrl } from "@/lib/deployed";
import { SearchBusyError, SearchLimitError } from "@/lib/pricing/errors";
import { getCurrentUser } from "@/lib/session";

const input = z.object({
  query: z.string().trim().min(1).max(100),
  kind: z.enum(["raw", "graded", "sealed"]),
  language: z.enum(["en", "ja", "zh"]),
  // "cached" answers from the catalog at once; "fresh" also asks the provider.
  phase: z.enum(["cached", "fresh"]),
});

// A route handler, not a server action: the client runs actions one at a
// time, so a slow provider call would hold up the next keystroke's cached answer.
export async function POST(req: Request) {
  // Route handlers get no CSRF check from Next, unlike server actions; a
  // provider call costs credits and the user's hourly lookups.
  if (req.headers.get("origin") !== appUrl().origin)
    return Response.json({ error: "Wrong origin." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in again." }, { status: 401 });
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Bad search." }, { status: 400 });
  const { query, phase, ...opts } = parsed.data;
  const db = getDb();
  if (phase === "cached") {
    const { items, answered } = await searchCached(db, query, opts);
    return Response.json({ items: await withMarket(db, items), answered });
  }
  try {
    const items = await searchFresh(
      db,
      query,
      opts,
      undefined,
      missLimit(db, user.id),
    );
    return Response.json({ items: await withMarket(db, items) });
  } catch (err) {
    // Any provider failure leaves the cached answer on screen; say which.
    const failure: SearchFailure =
      err instanceof SearchLimitError
        ? "limit"
        : err instanceof SearchBusyError
          ? "busy"
          : "down";
    if (failure === "down")
      console.error("[catalog-search] provider failed", err);
    return Response.json({
      failure,
      limit: failure === "limit" ? MISSES_PER_HOUR : undefined,
    });
  }
}
