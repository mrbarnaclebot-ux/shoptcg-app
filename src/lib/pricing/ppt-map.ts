import type {
  CatalogHit,
  HistoryPoint,
  Language,
  PriceRef,
  Quote,
} from "./provider";

// Maps PPT response bodies to our types. Shapes in ./ppt.ts header comment.
export interface PptGradeStats {
  count?: number;
  averagePrice?: number | null;
  medianPrice?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  smartMarketPrice?: { price?: number | null } | null;
}

export interface PptCard {
  tcgPlayerId: string;
  name: string;
  setName: string;
  cardNumber?: string | null;
  imageCdnUrl400?: string | null;
  prices?: { market?: number | null; low?: number | null; listings?: number };
  ebay?: {
    salesByGrade?: Record<string, PptGradeStats>;
    priceHistory?: Record<
      string,
      Record<string, { average?: number; count?: number }>
    >;
  };
  priceHistory?: {
    conditions?: Record<
      string,
      { history?: { date: string; market: number; volume?: number | null }[] }
    >;
  };
}

export interface PptSealed {
  tcgPlayerId: string;
  name: string;
  setName: string;
  unopenedPrice?: number | null;
  imageCdnUrl400?: string | null;
  priceHistory?: { date: string; unopenedPrice: number }[];
}

// PSA 10 -> "psa10", CGC 9.5 -> "cgc9_5": PPT's salesByGrade keys.
function gradeKey(ref: PriceRef) {
  return `${ref.grader?.toLowerCase()}${ref.grade?.replace(".", "_")}`;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Live data reports low: 0 when there is no listing low; 0 or less is never a price.
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
    positive(s.smartMarketPrice?.price) ??
    positive(s.medianPrice) ??
    positive(s.averagePrice)
  );
}

export function cardHit(c: PptCard, language: Language): CatalogHit {
  return {
    provider: "ppt",
    // Missing ids stay empty (upsertHits drops them), never the string "null".
    providerId: c.tcgPlayerId == null ? "" : String(c.tcgPlayerId),
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

export function sealedHit(p: PptSealed, language: Language): CatalogHit {
  const { tcgPlayerId, name, setName, imageCdnUrl400 } = p;
  const base = cardHit(
    { tcgPlayerId, name, setName, imageCdnUrl400 },
    language,
  );
  return { ...base, kind: "sealed" };
}

export function quote<T extends PriceRef>(
  ref: T,
  data: unknown,
): Quote<T> | null {
  if (ref.kind === "sealed") {
    const market = positive((data as PptSealed).unopenedPrice);
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
      sampleSize: num(s.count),
      recent: history(ref, data).slice(-RECENT_DAYS),
    };
  }
  const market = positive(c.prices?.market);
  if (market === null) return null;
  const sampleSize = num(c.prices?.listings);
  const recent = history(ref, data).slice(-RECENT_DAYS);
  return {
    ref,
    marketUsd: market,
    lowUsd: positive(c.prices?.low),
    highUsd: null,
    sampleSize,
    ...(recent.length ? { recent } : {}),
  };
}

/** Days of sales the nightly price call asks for and keeps. */
export const RECENT_DAYS = 7;

// A count we can show: whole, zero or more. Anything else is "unknown".
function sold(v: unknown) {
  const n = num(v);
  return n !== null && n >= 0 ? Math.round(n) : null;
}

export function history(ref: PriceRef, data: unknown): HistoryPoint[] {
  if (ref.kind === "sealed") {
    const rows = (data as PptSealed).priceHistory ?? [];
    return rows
      .filter((r) => positive(r.unopenedPrice) !== null)
      .map((r) => ({ date: r.date.slice(0, 10), marketUsd: r.unopenedPrice }));
  }
  const c = data as PptCard;
  if (ref.kind === "graded") {
    const days = c.ebay?.priceHistory?.[gradeKey(ref)] ?? {};
    return Object.entries(days)
      .filter(([, d]) => positive(d.average) !== null)
      .map(([date, d]) => ({
        date,
        marketUsd: d.average as number,
        sales: sold(d.count),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  const rows = c.priceHistory?.conditions?.["Near Mint"]?.history ?? [];
  return rows
    .filter((r) => positive(r.market) !== null)
    .map((r) => ({
      date: r.date.slice(0, 10),
      marketUsd: r.market,
      sales: sold(r.volume),
    }));
}
