import { expect, it, vi } from "vitest";
import rawCards from "./fixtures/ppt-cards-search.json";
import { ppt } from "./ppt";
import { query, raw } from "./test-fetch";

// Own file: it uses this module's shared throttle.
it("lets a search go ahead of queued background pricing, keeping the spacing", async () => {
  const calls: { at: number; search: boolean }[] = [];
  vi.stubGlobal("fetch", async (input: string) => {
    const url = new URL(input);
    calls.push({ at: Date.now(), search: url.searchParams.has("search") });
    return url.searchParams.has("search")
      ? Response.json(rawCards)
      : new Response("not found", { status: 404 });
  });
  const gap = 100;
  const sync = ppt("k", { gapMs: gap, maxWaitMs: Infinity, yields: true });
  const search = ppt("k", { gapMs: gap, maxWaitMs: 1.5 * gap });
  // Three adds pricing at once, as during a big import.
  const batches = [0, 1, 2].map((b) =>
    sync.getPrices([0, 1, 2].map((i) => ({ ...raw, providerId: `p${b}${i}` }))),
  );
  await new Promise((r) => setTimeout(r, gap / 2));
  // Without the priority lane, the batches would have booked slots far
  // enough ahead that this throws "busy".
  await search.search(query({}));
  const at = calls.findIndex((c) => c.search);
  expect(at).toBeGreaterThan(0);
  expect(at).toBeLessThanOrEqual(2);
  await Promise.all(batches);
  expect(calls).toHaveLength(10);
  // PPT's per-minute cap: ten calls take at least nine gaps. (Per pair is
  // too strict to time: a call can leave the throttle a few ms late.)
  expect(calls[9].at - calls[0].at).toBeGreaterThanOrEqual(9 * gap - 20);
});
