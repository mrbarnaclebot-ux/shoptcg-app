import { afterEach, describe, expect, it, vi } from "vitest";
import enSearch from "./fixtures/tcgdex-en-search.json";
import enCard from "./fixtures/tcgdex-en-sv03.5-199.json";
import jaSearch from "./fixtures/tcgdex-ja-search.json";
import jaCard from "./fixtures/tcgdex-ja-SV2a-006.json";
import { raw, query, serve } from "./test-fetch";
import { tcgdex } from "./tcgdex";

afterEach(() => vi.unstubAllGlobals());

describe("tcgdex adapter", () => {
  it("maps an EN search hit with set name and image", async () => {
    serve([
      ["/en/cards?", enSearch],
      ["/en/cards/sv03.5-199", enCard],
    ]);
    const [hit] = await tcgdex.search(query({}));
    expect(hit).toEqual({
      provider: "tcgdex",
      providerId: "sv03.5-199",
      kind: "raw",
      language: "en",
      name: "Charizard ex",
      setName: "151",
      number: "199",
      imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/199/high.webp",
      grader: null,
      grade: null,
    });
  });

  it("maps a JA hit and leaves it unpriced (TCGdex has no USD for JA)", async () => {
    // Only the first brief has a detail fixture; the other 404s and is dropped.
    serve([
      ["/ja/cards?", jaSearch],
      ["/ja/cards/SV2a-006", jaCard],
    ]);
    const hits = await tcgdex.search(
      query({
        text: "リザードンex 006",
        name: "リザードンex",
        number: "006",
        language: "ja",
      }),
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      name: "リザードンex",
      setName: "ポケモンカード151",
    });
    expect(await tcgdex.getPrices(hits)).toEqual([]);
  });

  it("prices EN raw from the TCGplayer block and skips graded and sealed", async () => {
    serve([["/en/cards/sv03.5-199", enCard]]);
    const ref = { ...raw, providerId: "sv03.5-199" };
    const quotes = await tcgdex.getPrices([
      ref,
      { ...ref, kind: "sealed" as const },
    ]);
    expect(quotes).toEqual([
      {
        ref,
        marketUsd: 295.26,
        lowUsd: 233.96,
        highUsd: 10000,
        sampleSize: null,
      },
    ]);
  });

  it("skips a quote whose market price is 0 or negative", async () => {
    const bad = structuredClone(enCard);
    for (const p of Object.values(bad.pricing.tcgplayer))
      if (typeof p === "object") Object.assign(p, { marketPrice: -1 });
    serve([["/en/cards/sv03.5-199", bad]]);
    const ref = { ...raw, providerId: "sv03.5-199" };
    expect(await tcgdex.getPrices([ref])).toEqual([]);
  });

  it("returns nothing for graded or sealed searches", async () => {
    const calls = serve([]);
    expect(await tcgdex.search(query({ kind: "graded" }))).toEqual([]);
    expect(await tcgdex.search(query({ kind: "sealed" }))).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
