import type {
  CatalogHit,
  Language,
  PriceProvider,
  PriceRef,
  Quote,
  SearchQuery,
} from "./provider";

// Free, keyless, verified live 2026-11-08. Raw cards only: no graded, no sealed.
// Its embedded TCGplayer prices have unclear licence terms, so they are stored
// under source "tcgdex" for cross-checking and never shown as the display price.
const BASE = "https://api.tcgdex.net/v2";
const LANG: Record<Language, string> = { en: "en", ja: "ja", zh: "zh-tw" };
// Preferred when a card has several printings priced.
const PRINTINGS = ["normal", "holofoil", "reverse-holofoil"];

interface TcgdexBrief {
  id: string;
}

interface TcgplayerPrice {
  marketPrice?: number | null;
  lowPrice?: number | null;
  highPrice?: number | null;
}

interface TcgdexCard {
  id: string;
  localId: string;
  name: string;
  image?: string;
  set: { name: string };
  pricing?: { tcgplayer?: Record<string, unknown> | null };
}

async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(BASE + path, { signal: AbortSignal.timeout(15_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`TCGdex ${res.status} for ${path}`);
  return (await res.json()) as T;
}

function toHit(card: TcgdexCard, language: Language): CatalogHit {
  return {
    provider: "tcgdex",
    providerId: card.id,
    kind: "raw",
    language,
    name: card.name,
    setName: card.set.name,
    number: card.localId,
    // The image field is a base URL; the asset needs a quality and extension.
    imageUrl: card.image ? `${card.image}/high.webp` : null,
    grader: null,
    grade: null,
  };
}

function tcgplayerPrice(card: TcgdexCard): TcgplayerPrice | null {
  const tp = card.pricing?.tcgplayer;
  if (!tp) return null;
  const keys = Object.keys(tp).filter((k) => k !== "unit" && k !== "updated");
  keys.sort((a, b) => rank(a) - rank(b));
  const priced = keys
    .map((k) => tp[k] as TcgplayerPrice)
    .find((p) => typeof p?.marketPrice === "number");
  return priced ?? null;
}

function rank(printing: string) {
  const i = PRINTINGS.indexOf(printing);
  return i === -1 ? PRINTINGS.length : i;
}

async function search(q: SearchQuery): Promise<CatalogHit[]> {
  if (q.kind !== "raw" || (!q.name && !q.number)) return [];
  const params = new URLSearchParams({
    "pagination:itemsPerPage": String(q.limit),
  });
  if (q.name) params.set("name", q.name);
  if (q.number) params.set("localId", q.number);
  if (q.setTotal) params.set("set.cardCount.official", q.setTotal);
  const lang = LANG[q.language];
  const briefs = (await get<TcgdexBrief[]>(`/${lang}/cards?${params}`)) ?? [];
  // The list endpoint omits the set name, so each hit needs its detail call.
  const cards = await Promise.all(
    briefs.map((b) => get<TcgdexCard>(`/${lang}/cards/${b.id}`)),
  );
  return cards
    .filter((c): c is TcgdexCard => c !== null)
    .map((c) => toHit(c, q.language));
}

async function getPrices<T extends PriceRef>(refs: T[]): Promise<Quote<T>[]> {
  const quotes: Quote<T>[] = [];
  for (const ref of refs) {
    if (ref.kind !== "raw") continue;
    const path = `/${LANG[ref.language]}/cards/${ref.providerId}`;
    const card = await get<TcgdexCard>(path);
    const price = card && tcgplayerPrice(card);
    if (!price || typeof price.marketPrice !== "number") continue;
    quotes.push({
      ref,
      marketUsd: price.marketPrice,
      lowUsd: price.lowPrice ?? null,
      highUsd: price.highPrice ?? null,
      sampleSize: null,
    });
  }
  return quotes;
}

export const tcgdex: PriceProvider = {
  name: "tcgdex",
  search,
  getPrices,
  // TCGdex has no price history; our own price_point rows build it.
  getHistory: async () => [],
};
