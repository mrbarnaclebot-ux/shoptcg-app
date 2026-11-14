import { afterEach, describe, expect, it, vi } from "vitest";
import gradedCard from "./fixtures/ppt-card-graded.json";
import history from "./fixtures/ppt-card-history.json";
import jaCards from "./fixtures/ppt-cards-ja.json";
import rawCards from "./fixtures/ppt-cards-search.json";
import sealedOne from "./fixtures/ppt-sealed-one-docs.json";
import sealed from "./fixtures/ppt-sealed-search.json";
import { PartialPricesError } from "./errors";
import { ppt } from "./ppt";
import { raw, query, serve } from "./test-fetch";
import { tcgdex } from "./tcgdex";

afterEach(() => vi.unstubAllGlobals());

// Fixtures are live Pro-plan responses from 2026-11-08, trimmed.
describe("ppt adapter (recorded fixtures)", () => {
  const client = ppt("test-key", { gapMs: 0, maxWaitMs: Infinity });
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
    // A single's nightly price asks for a week of history: its sales counts.
    expect(calls[0].searchParams.get("includeHistory")).toBe("true");
    expect(calls[0].searchParams.get("days")).toBe("7");
    serve([["/cards?", history]]);
    const [withSales] = await client.getPrices([raw]);
    expect(withSales.recent?.map((p) => p.sales)).toEqual([3, 3, 4, null]);
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
    // Each day's Near Mint sales come along; the last day has no count yet.
    expect(
      (await client.getHistory(raw, 5)).map((p) => [p.date, p.sales]),
    ).toEqual([
      ["2026-11-04", 3],
      ["2026-11-05", 3],
      ["2026-11-06", 4],
      ["2026-11-07", null],
    ]);
    serve([["/cards?", gradedCard]]);
    expect(await client.getHistory(psa, 30)).toEqual([
      { date: "2026-11-02", marketUsd: 1172.1, sales: 5 },
      { date: "2026-11-04", marketUsd: 1250, sales: 1 },
      { date: "2026-11-05", marketUsd: 1200, sales: 1 },
    ]);
  });

  // Shaped per the docs (llms-full.txt, 2026-11-12), not recorded: no live
  // single-item /sealed-products response has been seen yet.
  it("prices sealed and reads its history from one object or a one-item list", async () => {
    const box = { ...raw, providerId: "506640", kind: "sealed" as const };
    const calls = serve([["/sealed-products?", sealedOne]]);
    expect((await client.getPrices([box]))[0].marketUsd).toBe(6750);
    expect(calls[0].searchParams.get("tcgPlayerId")).toBe("506640");
    expect(await client.getHistory(box, 90)).toEqual([
      { date: "2026-11-05", marketUsd: 6700 },
      { date: "2026-11-07", marketUsd: 6750 },
    ]);
    serve([["/sealed-products?", { data: [sealedOne.data] }]]);
    expect((await client.getPrices([box]))[0].marketUsd).toBe(6750);
    serve([["/sealed-products?", { data: [] }]]);
    expect(await client.getPrices([box])).toEqual([]);
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
    const err = await client.getPrices([raw]).catch((e) => e);
    expect(err).toBeInstanceOf(PartialPricesError);
    expect(err.cause.message).toContain("PPT 429");
  });

  it("skips market <= 0 and keeps paid quotes when one item fails", async () => {
    const zero = { ...rawCards.data[0], prices: { market: 0, low: 5 } };
    serve([["/cards?", { data: zero }]]);
    expect(await client.getPrices([raw])).toEqual([]);
    vi.stubGlobal("fetch", async (input: string) =>
      input.includes("tcgPlayerId=1")
        ? new Response("boom", { status: 500 })
        : Response.json({ data: rawCards.data[0] }),
    );
    const err = await client
      .getPrices([{ ...raw, providerId: "1" }, raw])
      .catch((e) => e);
    expect(err).toBeInstanceOf(PartialPricesError);
    expect([err.failed, err.quotes[0].marketUsd]).toEqual([1, 296.24]);
  });

  it("maps a hit with no id to an empty id, never the string null", async () => {
    const noId = { ...rawCards.data[0], tcgPlayerId: null };
    serve([["/cards?", { data: [noId] }]]);
    const [hit] = await client.search(query({}));
    expect(hit.providerId).toBe("");
  });
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
