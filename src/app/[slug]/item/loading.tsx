import { LoadingArt } from "./loading-art";

/**
 * The item page's shape while it reads, in the store grid's loading art box,
 * so a tap on venue wifi shows the page at once instead of nothing. It sits
 * above [id], not beside the page: the 30/90 day switch only changes the
 * query, and a boundary keyed on it would blank the whole page each time.
 */
export default function Loading() {
  return (
    <main className="mx-auto grid w-full max-w-[1200px] flex-1 content-start gap-x-12 px-4 pt-4 md:px-6 lg:grid-cols-[minmax(0,420px)_1fr] lg:px-8 lg:pt-8">
      <p role="status" className="sr-only">
        Loading the item
      </p>
      {/* Where Back to store and the seller line go. */}
      <span aria-hidden className="h-[5.5rem] lg:col-span-2" />
      <div
        aria-hidden
        className="mx-auto mt-3 w-4/5 max-w-[420px] lg:w-full lg:self-start"
      >
        <LoadingArt />
      </div>
      <div aria-hidden className="mt-6 flex flex-col gap-4 lg:mt-3">
        <span className="h-10 w-3/4 bg-surface md:h-12" />
        <span className="h-4 w-1/2 bg-surface" />
        <span className="h-12 w-28 bg-surface" />
        <span className="h-12 w-full max-w-sm bg-surface" />
      </div>
    </main>
  );
}
