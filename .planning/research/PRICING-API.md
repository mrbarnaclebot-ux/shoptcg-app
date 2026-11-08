# Pricing API spike (docs-level, no API key)

Date: 2026-11-08. Method: official docs/llms.txt fetched, plus unauthenticated curl. No authenticated calls were made.
Legend: [V] verified from an official page or a live call today. [U] unverified (secondary source, inferred, or not stated).

## Recommendation

1. **Keep PokemonPriceTracker (PPT) as primary, but budget for the Business plan ($99/mo), not the $10-30 in PROJECT.md.** PPT's own licensing page says Free and Pro ($9.99) are "personal, hobby, educational, and pre-launch development use only". Commercial use needs Business, and "commercial" explicitly includes "pricing your own inventory", any revenue, and ad-supported sites. Vendors selling cards from a shoptcg.app page almost certainly count. [V] https://www.pokemonpricetracker.com/llms.txt and https://www.pokemonpricetracker.com/terms
   - Dev and the owner-and-friends hobby phase can run on Pro ($9.99) as "pre-launch/hobby". Decide before any public launch. Support replies are never approvals (their words), so assume the strict reading.
2. **Use TCGdex for card metadata + images + a free EUR/USD raw-price cross-check.** It needs no key, covers en and ja and zh-tw, and (surprise) its card payload already carries TCGplayer USD and Cardmarket EUR prices. [V, live call] Licence/ToS of the embedded prices is unstated [U], so do not treat it as a primary price source until checked.
3. **Fallback = Scrydex, not JustTCG, for Japanese and graded.** pokemontcg.io is being superseded by Scrydex (the Scrydex docs say so) and `api.pokemontcg.io` returned HTTP 500 on every call today. [V] JustTCG's Japan coverage is not confirmed: its localized-pricing docs say only region `NA` returns data today, `JP` is reserved. [V]
4. **Chinese stays manual** (as already decided). TCGdex has zh-tw card data (names, sets) but no price for it. [V]
5. **Proxy and cache card images ourselves** (download once to Railway volume/bucket or serve through Next image optimisation with a long cache). No provider grants an image licence; PPT says explicitly "no license to any image or artwork is granted, on any plan" and URLs may change. [V]

## Comparison

| | PokemonPriceTracker | JustTCG | Scrydex (pokemontcg.io successor) | TCGdex |
|---|---|---|---|---|
| Base URL | `https://www.pokemonpricetracker.com/api/v2` [V] | `https://api.justtcg.com/v1` (v2 cards also exist) [V] | `https://api.scrydex.com/pokemon/v1/...` [V endpoint answers 401] | `https://api.tcgdex.net/v2/{lang}` [V] |
| Auth | `Authorization: Bearer KEY` [V, 401 message] | `x-api-key: KEY` [V] | key + team headers [U] | none [V] |
| Search | `GET /cards?search=` [V] | `GET /cards` [V] | `/cards` search [V docs list] | `GET /cards?name=` (`like:` prefix for partial) [V] |
| Raw by condition | Yes, NM/LP/MP/HP/DMG via `includeHistory=true` -> `priceHistory.variants[printing][condition]`; default response is NM only per printing [V] | Yes, `condition` + printing per variant [V] | Yes [U detail] | No per-condition; TCGplayer low/mid/high/market per printing, Cardmarket avg/low/trend [V] |
| Graded PSA/BGS/CGC/SGC | `includeEbay=true`: sales stats per grade (`salesByGrade.psa10` etc: averagePrice, medianPrice, smartMarketPrice, marketPrice7Day) from eBay + Fanatics Collect. This is sold-comps stats, not a slab price list. Individual sales Business-only. [V] | `graded=only/include`, `grading_company`, `grade`; price null until slab sells, expires 90 days after last sale [V] | Graded prices included in all plans [V] | None [V] |
| Sealed | `GET /sealed-products` [V] | Lookup by `gtin` barcode only, coverage "growing" [V] | Sealed products endpoint [V] | None [V] |
| Japanese | `language=japanese` on /cards, /sets, /sealed-products. History starts late Oct 2025 [V] | Not confirmed [U] | Not stated on pages read [U] | `/v2/ja`, cards with images and TCGplayer/Cardmarket price (checked SV1S-001) [V] |
| Chinese | None [U] | None [U] | Not stated [U] | `zh-tw` sets and cards, no price, no image on card sampled [V] |
| History | `includeHistory=true`, `days`, `maxDataPoints`, daily `{date, market, volume}`; EN from Jan 2025, JA from Oct 2025. Plan cap: Free 3d, Pro 180d, Business full [V] | `price_history [{t,p}]`, `periods` stats [V] | Price History endpoint, 3 credits [V] | None |
| Batch | No batch-by-id on GET /cards (single `tcgPlayerId`, or `fetchAllInSet=true`, or `search`). `/population` takes up to 50 ids. `/export` CSV daily dump (Business only, no credits, 20 downloads/day) [V] | `POST /cards` up to 200 per call (plan-limited 20/100/200), counts as 1 request [V] | Not confirmed [U] | n/a |
| Rate limit | Free/Pro 60 calls/min, Business 500/min [V] | Free 10/min, Starter 50/min [V] | credits only [U] | none stated [U] |
| Quota and price | Free 100 credits/day; Pro $9.99 20k/day; Business $99 200k/day; Enterprise $300 1M/day [V] | Free 1k req/mo; $19 10k/mo; $49 50k/mo; $149 500k/mo [V] | $29 5k credits; $99 50k; $399 250k; overage $0.002-0.006/credit [V] | Free [V] |
| Commercial | Business+ only [V] | Paid plans include commercial licence [V] | Not read [U] | Open source (MIT repo), price-data terms unstated [U] |

## Key PPT facts for our design

- Credits: 1 base per card, +1 history, +1 eBay/graded, +1 Cardmarket (EN only, Japanese not charged). Billed on requested `limit` (default 50), so ALWAYS pass `limit=1` on single lookups. Multi-result calls also burn per-minute credits `min(30, ceil(limit/10))`. [V]
- `fetchAllInSet=true` with no limit returns a whole set in one call, billed once at set size x per-card cost. Cheapest for set-wide syncs; wasteful for 500 scattered items. [V]
- `GET /cards/{id}` takes `tcgPlayerId` (stable numeric) or a 24-char Mongo id. Use `tcgPlayerId` as `catalog_item.provider_id`. [V]
- Card fields: `tcgPlayerId, name, setName, setId, cardNumber, rarity, cardType, printingsAvailable, variants{printing:{marketPrice,lowPrice,conditionUsed}}, prices{market,low,sellers,listings,primaryPrinting,lastUpdated}, imageCdnUrl200/400/800, tcgPlayerUrl`. Deprecated: `prices.conditions`, full `prices.variants`, `recentSales`. [V]
- `marketPrice` can be a lower condition when no NM listing exists; check `conditionUsed`. [V]
- Every response has `metadata.apiCallsConsumed`; headers `X-API-Calls-Consumed`, `X-RateLimit-Daily-Remaining`. 429 has `Retry-After`. Daily reset 00:00 UTC. [V]
- Prices refresh once daily; `prices.listings/sellers` refresh daily (>= $10), weekly ($1-10), monthly (<$1). So nightly sync is the right cadence, and cheap cards will be stale by design. [V]
- Docs warn the terms can change with no notice; no SLA; no endorsement claims allowed. [V]
- Machine-readable specs: https://www.pokemonpricetracker.com/api/openapi and https://www.pokemonpricetracker.com/llms-full.txt. The human docs page is JS-rendered and unfetchable; use llms-full.txt.

## Live calls made (no key)

TCGdex `GET https://api.tcgdex.net/v2/en/cards/swsh3-136` returned 200. Top-level keys:
`category, id, illustrator, image, localId, name, rarity, set{id,name,logo,symbol,cardCount}, variants{normal,reverse,holo,firstEdition,wPromo}, variants_detailed[{type,size,thirdParty{cardmarket,tcgplayer},variantId,pricing{cardmarket{updated,unit:"EUR",avg,low,trend,avg1,avg7,avg30,...},tcgplayer{updated,unit:"USD",normal{productId,lowPrice,midPrice,highPrice,marketPrice,directLowPrice},reverse-holofoil{...}}}}], dexId, hp, types, evolveFrom, description, stage, attacks, weaknesses, retreat, regulationMark, legal, updated, pricing`.
- Prices were stamped `2026-11-07T23:50Z`, so they update daily. TCGplayer product id is exposed (`thirdParty.tcgplayer: 219333`), which is the same id space PPT uses as `tcgPlayerId` [inferred, U], giving a free join key.
- `image` is a base URL with no extension: append `/high.webp` (HTTP 200, `Access-Control-Allow-Origin: *`).
- `GET /v2/ja/cards/SV1S-001` returned Japanese name, image and TCGplayer/Cardmarket pricing. `GET /v2/ja/sets` and `/v2/zh-tw/sets` return sets (`SC2D 無極力量`...). `zh-tw/cards/SC2D-001` has data but no image field and `variantId:"generated"`, no price.
- List search `GET /v2/en/cards?name=Furret&pagination:itemsPerPage=2` returns brief `[{id,localId,name,image}]`. Japanese `name=ピカチュウ` exact match returned `[]`; `name=like:` also `[]` (probably needs katakana-exact or different field) [U, not debugged].
- zh-cn sets endpoint also responds (`CSM1bC 横空出世 苍`) [V], though the homepage lists only Traditional.
- pokemontcg.io `GET https://api.pokemontcg.io/v2/cards/swsh3-136` returned a full card once, then every later call (cards query, sets) returned HTTP 500. Image host `https://images.pokemontcg.io/swsh3/136.png` returned 200, `Cache-Control: public, max-age=31536000`. Treat the API as unreliable and being replaced by Scrydex. [V]
- PPT unauthenticated `GET /api/v2/cards` returned 401 `Authorization header missing. Use: Authorization: Bearer YOUR_API_KEY`. [V]
- JustTCG `/v1/games` and Scrydex `/pokemon/v1/ja/expansions` return 401 without a key. [V]

## ToS risks

| Risk | Severity | Detail / mitigation |
|---|---|---|
| Commercial licence | HIGH | Pro does not cover a public store page used by selling vendors. Budget Business $99/mo from launch, or confirm with PPT (they will not give written approval, so go strict). |
| Public display of prices | Medium | Allowed on Business for our own end users (buyers on store pages). Do not expose a public JSON endpoint that mirrors raw PPT data: "competing API" rule. Keep price data behind server-rendered pages, no bulk list endpoint, rate limit the store API. |
| Storing daily snapshots | Low | Explicitly allowed ("caching and storing responses in your own database to serve your own end users"). Keep `price_point` private to our DB. Do not bulk-download in anticipation of cancel. Data retained after cancel is OK. |
| Attribution | Low | Not required. May say "prices from Pokemon Price Tracker" factually; must not imply endorsement or use their logo. |
| Images | Medium | No image licence from anyone. Pokemon Company owns the art. Use cached small WebP, low-res thumbnails, link out where possible. Accept residual IP risk; same for every competitor. |
| Terms changes / no SLA | Medium | Terms say no notice. The adapter + local snapshots limit the damage. |
| Graded data semantics | Medium | PPT graded = eBay/Fanatics sold stats, not authoritative slab prices; label as "recent sales" and show `count`. |
| TCGdex price terms | Unknown | Prices embedded in TCGdex come from TCGplayer/Cardmarket, whose own terms may restrict reuse. Use as fallback/cross-check only until verified. |

## Estimated monthly cost (5 vendors x 500 items, nightly)

Assume 2,500 listings, ~1,800 unique after overlap (assume 30% overlap) [U].
- Raw, 1 credit each, `limit=1`: ~2,500 credits/night. Raw + graded (+1): ~5,000 credits/night worst case. Add history only on first add (2 credits), not nightly, since our own `price_point` builds history. All far below 20,000/day. Calls: 2,500/night at 60/min = ~42 min of sync, fine for cron on any plan; Business (500/min) finishes in ~5 min.
- **Plan cost: $9.99/mo Pro (hobby/pre-launch only) or $99/mo Business (commercial).** Plan on $99.
- Alternative on Business: nightly `/export?type=printings` + `sealed` + `ebay` CSV dumps, 0 credits, 20 downloads/day, regenerated 06:00 UTC. Download once, load all prices into a local table, no per-card API calls at all. Cheapest and most robust sync; downside is a large file (all cards) each night and Business-only. [V docs, U real file size]
- JustTCG fallback: batch POST 200/request, 2,500 items = ~13 requests/night = ~390/mo, fits the $0 Free tier on volume if it supports our cards; Starter $19 for commercial. Japan unconfirmed.
- Hosting/images/etc not included.

## Newer in 2026

- Scrydex now presents itself as successor to pokemontcg.io (Pokemon, MTG, Lorcana, Gundam, One Piece, Riftbound), with raw + graded prices, pop reports, price history, webhooks for price changes, sealed products. $29/5k credits is expensive for nightly refresh of 2,500 items (price lookups ~1 credit each = ~75k/month, about the $99 tier). Worth testing for Japanese. [V pricing, U Japanese]
- PPT added Fanatics Collect graded sales (Oct 2026), per-printing graded split, Cardmarket EUR (Mar 2026), daily sales volume, `/export` dumps, `/parse-title`. [V]
- JustTCG v2 cards: graded filtering, localized pricing, `JP` region reserved but not live. [V]
- TCGdex now returns TCGplayer + Cardmarket prices inline with variants. [V]
- Other names seen in search, not evaluated: PokeTrace, TCGIndex, TCGAPI, TCG Price Lookup, tcgcsv.com. [U]

## Proposed adapter interface (TypeScript)

```ts
export type Lang = "en" | "ja" | "zh";
export type Kind = "raw" | "graded" | "sealed";
export type Condition = "NM" | "LP" | "MP" | "HP" | "DMG";
export type Grader = "PSA" | "BGS" | "CGC" | "SGC";

/** One sellable thing. providerId is the provider's own stable id (PPT tcgPlayerId as string). */
export interface CatalogRef {
  provider: string;           // "ppt" | "justtcg" | "scrydex"
  providerId: string;
  kind: Kind;
  language: Lang;
}

export interface CatalogHit extends CatalogRef {
  name: string;
  setName: string;
  number?: string;            // cards only
  rarity?: string;
  printings: string[];        // "Normal", "Holofoil", "Reverse Holofoil", "1st Edition"...
  imageUrl?: string;          // provider URL; we cache/proxy it, never hotlink
}

/** What to price. Raw needs condition+printing, graded needs grader+grade, sealed neither. */
export interface PriceQuery extends CatalogRef {
  printing?: string;
  condition?: Condition;      // raw
  grader?: Grader;            // graded
  grade?: string;             // "10", "9.5"
}

export interface PriceResult {
  ref: PriceQuery;
  marketUsd: number | null;   // null = not priced, never 0
  lowUsd?: number | null;
  basis: "listing" | "sales";  // raw/sealed = listing-based, graded = recent sales
  sampleSize?: number;        // listings or sales behind the number
  conditionUsed?: Condition;  // if provider fell back to a lower condition
  asOf: string;               // ISO, provider's own timestamp
  stale?: boolean;
  error?: "not_found" | "no_price" | "rate_limited";
}

export interface HistoryPoint { date: string; marketUsd: number; volume?: number | null }

export interface PricingProvider {
  readonly name: string;
  search(q: { text: string; language: Lang; kind: Kind; limit?: number }): Promise<CatalogHit[]>;
  /** Batch in; adapter picks the cheapest way (limit=1 loop, batch POST, or CSV dump). Must honour Retry-After. */
  getPrices(queries: PriceQuery[]): Promise<PriceResult[]>;
  getHistory(q: PriceQuery, days: number): Promise<HistoryPoint[]>;
}
```

Notes: `zh` has no automated adapter (custom items in the DB); the type exists so listings share one shape. The sync job writes `PriceResult` into `price_point` and treats `null` as "keep yesterday's price, mark stale", never overwriting with 0. Rate-limit and credit tracking live inside the adapter (read `X-RateLimit-Daily-Remaining`).

## Open questions before step 2

1. Is shoptcg.app free for vendors or monetised? Either way PPT counts vendor-inventory pricing as commercial; get the owner's decision on Business ($99/mo).
2. With a real key, test: `tcgPlayerId` equality between PPT and TCGdex `thirdParty.tcgplayer`; per-call cost of `limit=1`; whether `/cards` with `language=japanese` returns usable `marketPrice` (JP data is TCGplayer-sourced, JA history only since Oct 2025); the real size of `/export?type=printings`.
3. Test Scrydex free/trial for Japanese and sealed.
4. Read TCGdex and TCGplayer/Cardmarket terms for re-use of the embedded prices.

## Sources

- https://www.pokemonpricetracker.com/llms.txt (primary: endpoints, credits, licensing summary)
- https://www.pokemonpricetracker.com/llms-full.txt
- https://www.pokemonpricetracker.com/pricing
- https://www.pokemonpricetracker.com/terms (Sections 6, 15)
- https://www.pokemonpricetracker.com/licensing
- https://justtcg.com/pricing, https://justtcg.com/docs, https://justtcg.com/docs/api/cards-v2, https://justtcg.com/docs/api/cards-v2/graded
- https://scrydex.com/pricing, https://scrydex.com/docs
- https://tcgdex.dev/ and https://api.tcgdex.net/v2/en/cards/swsh3-136 (live)
- https://github.com/tcgdex/cards-database (MIT licence)
- https://api.pokemontcg.io/v2/cards/swsh3-136 and https://images.pokemontcg.io/swsh3/136.png (live)
- https://www.scrapingbee.com/blog/pokemon-card-api/ (secondary)
