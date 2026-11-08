import { afterEach, describe, expect, it, vi } from "vitest";
import gradedCard from "./fixtures/ppt-card-graded.json";
import history from "./fixtures/ppt-card-history.json";
import jaCards from "./fixtures/ppt-cards-ja.json";
import rawCards from "./fixtures/ppt-cards-search.json";
import sealed from "./fixtures/ppt-sealed-search.json";
import enSearch from "./fixtures/tcgdex-en-search.json";
import enCard from "./fixtures/tcgdex-en-sv03.5-199.json";
import jaSearch from "./fixtures/tcgdex-ja-search.json";
import jaCard from "./fixtures/tcgdex-ja-SV2a-006.json";
import { parseGradeKey, ppt } from "./ppt";
import type { PriceRef, SearchQuery } from "./provider";
import { tcgdex } from "./tcgdex";

// Serves fixtures by URL substring; anything unmatched is a 404.
function serve(routes: [string, unknown][]) {
  const calls: URL[] = [];
  vi.stubGlobal("fetch", async (input: string) => {
    const url = new URL(input);
    calls.push(url);
    const hit = routes.find(([part]) => decodeURI(url.href).includes(part));
    return hit
      ? Response.json(hit[1])
      : new Response("not found", { status: 404 });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const query = (over: Partial<SearchQuery>): SearchQuery => ({
  text: "charizard 199",
  name: "charizard",
  number: "199",
  setTotal: null,
  kind: "raw",
  language: "en",
  limit: 10,
  ...over,
});

const raw: PriceRef = {
  providerId: "517045",
  kind: "raw",
  language: "en",
  grader: null,
  grade: null,
};

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

  it("returns nothing for graded or sealed searches", async () => {
    const calls = serve([]);
    expect(await tcgdex.search(query({ kind: "graded" }))).toEqual([]);
    expect(await tcgdex.search(query({ kind: "sealed" }))).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

// Fixtures are live Pro-plan responses from 2026-11-08, trimmed.
describe("ppt adapter (recorded fixtures)", () => {
  const client = ppt("test-key", 0);
  const psa = {
    ...raw,
    kind: "graded" as const,
    grader: "PSA" as const,
    grade: "10",
  };

  it("maps raw search, strips the number from the name, sends key and limit", async () => {
    const calls = serve([["/cards?", rawCards]]);
    const [hit] = await client.search(query({}));
    expect(hit).toEqual({
      provider: "ppt",
      providerId: "517045",
      kind: "raw",
      language: "en",
      name: "Charizard ex",
      setName: "SV: Scarlet & Violet 151",
      number: "199/165",
      imageUrl:
        "https://tcgplayer-cdn.tcgplayer.com/product/517045_in_400x400.jpg",
      grader: null,
      grade: null,
    });
    expect(calls[0].searchParams.get("search")).toBe("charizard 199");
    expect(calls[0].searchParams.get("limit")).toBe("10");
  });

  it("maps graded search to one hit per supported grader (TAG dropped)", async () => {
    serve([["/cards?", { data: [gradedCard.data] }]]);
    const hits = await client.search(query({ kind: "graded" }));
    expect(hits.map((h) => `${h.grader} ${h.grade}`)).toEqual([
      "PSA 10",
      "CGC 9.5",
      "PSA 8",
    ]);
  });

  it("prices raw, graded and sealed, sharing one call per card", async () => {
    const calls = serve([
      ["/sealed-products?", { data: sealed.data[0] }],
      ["/cards?", { data: rawCards.data[0] }],
    ]);
    const quotes = await client.getPrices([raw]);
    expect(quotes).toEqual([
      {
        ref: raw,
        marketUsd: 296.24,
        lowUsd: 168.5,
        highUsd: null,
        sampleSize: 241,
      },
    ]);
    serve([
      ["/sealed-products?", { data: sealed.data[0] }],
      ["/cards?", gradedCard],
    ]);
    const cgc = { ...psa, grader: "CGC" as const, grade: "9.5" };
    const box = { ...raw, providerId: "506640", kind: "sealed" as const };
    const more = await client.getPrices([psa, cgc, box]);
    expect(
      more.map((q) => [q.ref.grade, q.marketUsd, q.lowUsd, q.sampleSize]),
    ).toEqual([
      ["10", 1185.18, 288, 627],
      ["9.5", 372, 234, 71],
      [null, 6750, null, null],
    ]);
    expect(calls[0].searchParams.get("limit")).toBe("1");
  });

  it("maps JA with language=japanese; low 0 and null market are not prices", async () => {
    const calls = serve([["/cards?", jaCards]]);
    const hits = await client.search(query({ language: "ja" }));
    expect(hits[0]).toMatchObject({
      name: "Mega Charizard X ex",
      number: "110/080",
    });
    expect(calls[0].searchParams.get("language")).toBe("japanese");
    serve([
      ["tcgPlayerId=655886", { data: jaCards.data[0] }],
      ["/cards?", { data: jaCards.data[1] }],
    ]);
    const quotes = await client.getPrices(hits);
    expect(quotes.map((q) => [q.marketUsd, q.lowUsd])).toEqual([
      [686.26, null],
    ]);
  });

  it("maps sealed search and raw and graded history in date order", async () => {
    serve([["/sealed-products?", sealed]]);
    const [box] = await client.search(query({ kind: "sealed" }));
    expect(box).toMatchObject({
      kind: "sealed",
      name: "151 Elite Trainer Box Case",
      number: null,
    });
    serve([["/cards?", history]]);
    expect((await client.getHistory(raw, 5)).map((p) => p.date)).toEqual([
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
    ]);
    serve([["/cards?", gradedCard]]);
    expect(await client.getHistory(psa, 30)).toEqual([
      { date: "2026-11-02", marketUsd: 1172.1 },
      { date: "2026-11-04", marketUsd: 1250 },
      { date: "2026-11-05", marketUsd: 1200 },
    ]);
  });

  it("retries a 429 after Retry-After, then fails after max retries", async () => {
    let n = 0;
    vi.stubGlobal("fetch", async () =>
      n++ === 0
        ? new Response("slow down", {
            status: 429,
            headers: { "Retry-After": "0.01" },
          })
        : Response.json({ data: rawCards.data[0] }),
    );
    expect(await client.getPrices([raw])).toHaveLength(1);
    expect(n).toBe(2);
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response("", { status: 429, headers: { "Retry-After": "0.01" } }),
    );
    await expect(client.getPrices([raw])).rejects.toThrow("PPT 429");
  });

  it.each([
    ["psa10", { grader: "PSA", grade: "10" }],
    ["bgs9_5", { grader: "BGS", grade: "9.5" }],
    ["tag10", null],
    ["psa11", null],
  ])("parses grade key %s", (key, want) =>
    expect(parseGradeKey(key)).toEqual(want),
  );
});

describe.skipIf(!process.env.LIVE)("live smoke (LIVE=1)", () => {
  it("tcgdex finds and prices Charizard ex 199/165", async () => {
    const hits = await tcgdex.search(
      query({ text: "199/165", name: "", number: "199", setTotal: "165" }),
    );
    const hit = hits.find((h) => h.providerId === "sv03.5-199");
    expect(hit?.setName).toBe("151");
    const [q] = await tcgdex.getPrices([hit!]);
    expect(q.marketUsd).toBeGreaterThan(0);
  }, 30_000);

  // About 4 credits. Needs PPT_API_KEY in the environment or .env.
  it("ppt finds and prices raw and PSA 10 Charizard ex 199/165", async () => {
    try {
      process.loadEnvFile();
    } catch {}
    const key = process.env.PPT_API_KEY;
    expect(key, "PPT_API_KEY missing").toBeTruthy();
    const client = ppt(key!);
    const [hit] = await client.search(
      query({ text: "charizard ex 199/165", limit: 1 }),
    );
    expect(hit).toMatchObject({ providerId: "517045", name: "Charizard ex" });
    const graded = {
      ...hit,
      kind: "graded" as const,
      grader: "PSA" as const,
      grade: "10",
    };
    const quotes = await client.getPrices([hit, graded]);
    expect(quotes.map((q) => q.ref.kind)).toEqual(["raw", "graded"]);
    expect(quotes.every((q) => q.marketUsd > 0)).toBe(true);
  }, 60_000);
});
