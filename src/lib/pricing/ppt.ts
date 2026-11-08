import type {
  CatalogHit,
  Grader,
  HistoryPoint,
  Language,
  PriceProvider,
  PriceRef,
  Quote,
  SearchQuery,
} from "./provider";

// Shapes from https://www.pokemonpricetracker.com/llms-full.txt, checked against
// live Pro-plan calls on 2026-11-08 (fixtures in ./fixtures are those responses, trimmed).
const BASE = "https://www.pokemonpricetracker.com/api/v2";
// No Chinese coverage on PPT.
const LANG: Partial<Record<Language, string>> = {
  en: "english",
  ja: "japanese",
};
// Free and Pro allow 60 calls/min; too many 429s get the key banned.
const CALL_GAP_MS = 1_100;
const MAX_RETRIES = 3;
// Process-wide so every adapter instance (sync run, concurrent searches) shares one budget.
let nextCallAt = 0;

async function throttle(gapMs: number) {
  const wait = nextCallAt - Date.now();
  nextCallAt = Math.max(nextCallAt, Date.now()) + gapMs;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

/** Seconds from Retry-After, else exponential backoff: 5s, 10s, 20s. */
function backoffMs(res: Response, attempt: number) {
  const header = Number(res.headers.get("Retry-After"));
  return (
    (Number.isFinite(header) && header > 0 ? header : 5 * 2 ** attempt) * 1000
  );
}

interface PptGradeStats {
  count?: number;
  averagePrice?: number | null;
  medianPrice?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  smartMarketPrice?: { price?: number | null } | null;
}

interface PptCard {
  tcgPlayerId: string;
  name: string;
  setName: string;
  cardNumber?: string | null;
  imageCdnUrl400?: string | null;
  prices?: { market?: number | null; low?: number | null; listings?: number };
  ebay?: {
    salesByGrade?: Record<string, PptGradeStats>;
    priceHistory?: Record<string, Record<string, { average?: number }>>;
  };
  priceHistory?: {
    conditions?: Record<
      string,
      { history?: { date: string; market: number }[] }
    >;
  };
}

interface PptSealed {
  tcgPlayerId: string;
  name: string;
  setName: string;
  unopenedPrice?: number | null;
  imageCdnUrl400?: string | null;
  priceHistory?: { date: string; unopenedPrice: number }[];
}

type Params = Record<string, string | number | boolean>;

/** "psa10" -> PSA 10, "cgc9_5" -> CGC 9.5. Unknown keys are dropped. */
export function parseGradeKey(key: string) {
  const m = /^(psa|bgs|cgc|sgc)(10|[1-9](?:_5)?)$/.exec(key);
  if (!m) return null;
  return {
    grader: m[1].toUpperCase() as Grader,
    grade: m[2].replace("_", "."),
  };
}

function gradeKey(ref: PriceRef) {
  return `${ref.grader?.toLowerCase()}${ref.grade?.replace(".", "_")}`;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Live data reports low: 0 when there is no listing low; that is not a price.
function positive(v: unknown) {
  const n = num(v);
  return n !== null && n > 0 ? n : null;
}

// PPT names carry the number ("Charizard ex - 199/165"), which we store separately.
function cleanName(name: string, number?: string | null) {
  const suffix = number ? ` - ${number}` : "";
  return suffix && name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
}

function gradedMarket(s: PptGradeStats) {
  return (
    num(s.smartMarketPrice?.price) ?? num(s.medianPrice) ?? num(s.averagePrice)
  );
}

function card(c: PptCard, language: Language): CatalogHit {
  return {
    provider: "ppt",
    providerId: String(c.tcgPlayerId),
    kind: "raw",
    language,
    name: cleanName(c.name, c.cardNumber),
    setName: c.setName,
    number: c.cardNumber ?? null,
    imageUrl: c.imageCdnUrl400 ?? null,
    grader: null,
    grade: null,
  };
}

function gradedHits(c: PptCard, language: Language): CatalogHit[] {
  return Object.keys(c.ebay?.salesByGrade ?? {})
    .map(parseGradeKey)
    .filter((g) => g !== null)
    .map((g) => ({ ...card(c, language), kind: "graded" as const, ...g }));
}

function sealedHit(p: PptSealed, language: Language): CatalogHit {
  const { tcgPlayerId, name, setName, imageCdnUrl400 } = p;
  const base = card({ tcgPlayerId, name, setName, imageCdnUrl400 }, language);
  return { ...base, kind: "sealed" };
}

function quote<T extends PriceRef>(ref: T, data: unknown): Quote<T> | null {
  if (ref.kind === "sealed") {
    const market = num((data as PptSealed).unopenedPrice);
    return market === null
      ? null
      : {
          ref,
          marketUsd: market,
          lowUsd: null,
          highUsd: null,
          sampleSize: null,
        };
  }
  const c = data as PptCard;
  if (ref.kind === "graded") {
    const s = c.ebay?.salesByGrade?.[gradeKey(ref)];
    const market = s ? gradedMarket(s) : null;
    if (!s || market === null) return null;
    const [lowUsd, highUsd] = [positive(s.minPrice), positive(s.maxPrice)];
    return {
      ref,
      marketUsd: market,
      lowUsd,
      highUsd,
      sampleSize: s.count ?? null,
    };
  }
  const market = num(c.prices?.market);
  if (market === null) return null;
  const sampleSize = num(c.prices?.listings);
  return {
    ref,
    marketUsd: market,
    lowUsd: positive(c.prices?.low),
    highUsd: null,
    sampleSize,
  };
}

function history(ref: PriceRef, data: unknown): HistoryPoint[] {
  if (ref.kind === "sealed") {
    const rows = (data as PptSealed).priceHistory ?? [];
    return rows.map((r) => ({
      date: r.date.slice(0, 10),
      marketUsd: r.unopenedPrice,
    }));
  }
  const c = data as PptCard;
  if (ref.kind === "graded") {
    const days = c.ebay?.priceHistory?.[gradeKey(ref)] ?? {};
    return Object.entries(days)
      .filter(([, d]) => num(d.average) !== null)
      .map(([date, d]) => ({ date, marketUsd: d.average as number }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  const rows = c.priceHistory?.conditions?.["Near Mint"]?.history ?? [];
  return rows.map((r) => ({ date: r.date.slice(0, 10), marketUsd: r.market }));
}

export function ppt(apiKey: string, gapMs = CALL_GAP_MS): PriceProvider {
  async function request(path: string, params: Params): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      await throttle(gapMs);
      const qs = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      );
      const res = await fetch(`${BASE}${path}?${qs}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 404) return null;
      // 429 is rate limit, 503 is their documented "database overload, retry".
      if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
        nextCallAt = Date.now() + backoffMs(res, attempt);
        continue;
      }
      if (!res.ok) throw new Error(`PPT ${res.status} for ${path}`);
      return ((await res.json()) as { data: unknown }).data;
    }
  }

  // One item per call with limit=1: PPT bills on the requested limit, not results.
  function fetchOne(ref: PriceRef, extra: Params = {}) {
    const language = LANG[ref.language] ?? "english";
    const base = { tcgPlayerId: ref.providerId, language, limit: 1, ...extra };
    if (ref.kind === "sealed") return request("/sealed-products", base);
    return request(
      "/cards",
      ref.kind === "graded" ? { ...base, includeEbay: true } : base,
    );
  }

  async function search(q: SearchQuery): Promise<CatalogHit[]> {
    const language = LANG[q.language];
    if (!language || !q.text) return [];
    const params = { search: q.text.slice(0, 100), language, limit: q.limit };
    if (q.kind === "sealed") {
      const rows = ((await request("/sealed-products", params)) ??
        []) as PptSealed[];
      return rows.map((p) => sealedHit(p, q.language));
    }
    const extra: Params = q.kind === "graded" ? { includeEbay: true } : {};
    const rows = ((await request("/cards", { ...params, ...extra })) ??
      []) as PptCard[];
    return q.kind === "graded"
      ? rows.flatMap((c) => gradedHits(c, q.language))
      : rows.map((c) => card(c, q.language));
  }

  async function getPrices<T extends PriceRef>(refs: T[]): Promise<Quote<T>[]> {
    // Several grades of one card share a single call.
    const fetched = new Map<string, unknown>();
    const quotes: Quote<T>[] = [];
    for (const ref of refs) {
      const key = `${ref.kind}:${ref.providerId}`;
      if (!fetched.has(key)) fetched.set(key, await fetchOne(ref));
      const data = fetched.get(key);
      const q = data ? quote(ref, data) : null;
      if (q) quotes.push(q);
    }
    return quotes;
  }

  async function getHistory(ref: PriceRef, days: number) {
    const extra: Params =
      ref.kind === "graded" ? {} : { includeHistory: true, days };
    const data = await fetchOne(ref, extra);
    return data ? history(ref, data) : [];
  }

  return { name: "ppt", search, getPrices, getHistory };
}
