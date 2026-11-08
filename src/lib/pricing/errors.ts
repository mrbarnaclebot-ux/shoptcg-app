import type { PriceRef, Quote } from "./provider";

/** A failure whose message is safe and useful to show the person searching. */
export class SearchError extends Error {}

/** The hourly provider-lookup cap was hit; cached catalog results still work. */
export class SearchLimitError extends SearchError {}

/** Some prices in a batch failed; the quotes that did succeed are already paid for. */
export class PartialPricesError<T extends PriceRef = PriceRef> extends Error {
  constructor(
    readonly quotes: Quote<T>[],
    readonly failed: number,
    cause: unknown,
  ) {
    super(`${failed} price calls failed`, { cause });
  }
}
