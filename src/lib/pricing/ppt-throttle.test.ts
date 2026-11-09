import { expect, it } from "vitest";
import rawCards from "./fixtures/ppt-cards-search.json";
import { SearchError } from "./errors";
import { ppt } from "./ppt";
import { query, serve } from "./test-fetch";

// Own file: it leaves this module's shared throttle 60s in the future.
it("fails search fast instead of queueing behind a long throttle wait", async () => {
  serve([["/cards?", rawCards]]);
  const slow = ppt("test-key", { gapMs: 60_000, maxWaitMs: 5_000 });
  await slow.search(query({}));
  await expect(slow.search(query({}))).rejects.toBeInstanceOf(SearchError);
});
