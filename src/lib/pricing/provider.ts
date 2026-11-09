import { ppt, SYNC_RATE } from "./ppt";
import { tcgdex } from "./tcgdex";

export type Kind = "raw" | "graded" | "sealed";
export type Language = "en" | "ja" | "zh";
export type Grader = "PSA" | "BGS" | "CGC" | "SGC";

/** Enough to price one catalog item. A catalog_item row satisfies it. */
export interface PriceRef {
  providerId: string;
  kind: Kind;
  language: Language;
  grader: Grader | null;
  grade: string | null;
}

export interface CatalogHit extends PriceRef {
  provider: string;
  name: string;
  setName: string;
  number: string | null;
  imageUrl: string | null;
}

/** A parsed search box entry: "charizard 199" or "199/165". */
export interface SearchQuery {
  text: string;
  name: string;
  number: string | null;
  setTotal: string | null;
  kind: Kind;
  language: Language;
  limit: number;
}

export interface Quote<T extends PriceRef = PriceRef> {
  ref: T;
  marketUsd: number;
  lowUsd: number | null;
  highUsd: number | null;
  sampleSize: number | null;
}

export interface HistoryPoint {
  date: string;
  marketUsd: number;
}

export interface PriceProvider {
  readonly name: string;
  search(q: SearchQuery): Promise<CatalogHit[]>;
  /** Items the provider has no price for are left out, never priced at 0. */
  getPrices<T extends PriceRef>(refs: T[]): Promise<Quote<T>[]>;
  getHistory(ref: PriceRef, days: number): Promise<HistoryPoint[]>;
}

// PPT is the paid source of record; TCGdex keeps dev working with no key.
export function defaultProvider(): PriceProvider {
  const key = process.env.PPT_API_KEY;
  return key ? ppt(key) : tcgdex;
}

/** The nightly sync's adapter for rows stored under this provider name, if configured. */
export function providerByName(name: string): PriceProvider | null {
  if (name === tcgdex.name) return tcgdex;
  const key = process.env.PPT_API_KEY;
  if (name === "ppt" && key) return ppt(key, SYNC_RATE);
  return null;
}
