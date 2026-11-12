import { SectionMark } from "@/components/section-mark";
import { getDb } from "@/db";
import { floor, type FloorBasket } from "@/lib/floor";
import { usd } from "@/lib/format";
import { sellerTimeZone } from "@/lib/session";
import { getPublicStore } from "@/lib/storefront";

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

/**
 * Who is on the store page and the lists they are building. Read-only and
 * silent: a list holds no stock and only a sent request chimes. It re-reads
 * with the queue, on every live event and at least once a minute.
 */
export async function Floor({ slug }: { slug: string }) {
  const db = getDb();
  const store = await getPublicStore(db, slug);
  const now =
    store &&
    (await floor(db, store, await sellerTimeZone()).catch((err) => {
      console.error("[floor] load failed", err);
      return null;
    }));
  if (!now) return null;
  return (
    <section aria-labelledby="floor-h" className="flex flex-col gap-4">
      <SectionMark n={2} id="floor-h">
        At your table
      </SectionMark>
      <p data-testid="floor-counts">
        <span className="font-semibold">
          {people(now.onNow)} on your page now.
        </span>{" "}
        <span className="text-muted-foreground">
          {people(now.today)} today.
        </span>
      </p>
      {now.baskets.length ? (
        <ul className="flex flex-col gap-4">
          {now.baskets.map((b) => (
            <Basket key={b.tag} b={b} />
          ))}
        </ul>
      ) : (
        <p className="max-w-[44ch] border-t border-dashed border-border-strong pt-4 text-muted-foreground">
          No open carts. A buyer&apos;s cart shows here while they build it,
          before they send it.
        </p>
      )}
    </section>
  );
}

function Basket({ b }: { b: FloorBasket }) {
  const items = b.lines.reduce((n, l) => n + l.qty, 0);
  return (
    <li
      data-basket={b.tag}
      className={`flex flex-col gap-2 px-4 py-3 shadow-[inset_0_0_0_1px_var(--border-strong)] ${b.here ? "" : "text-muted-foreground"}`}
    >
      <p className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="font-display num text-[1.75rem] leading-none font-extrabold">
          {b.tag}
        </span>
        <span className="num text-sm">
          {items} {items === 1 ? "item" : "items"}, {usd(b.total)}
          {!b.here && ". Left the page."}
        </span>
      </p>
      <ul className="text-sm">
        {b.lines.map((l) => (
          <li
            key={l.id}
            className="flex flex-wrap justify-between gap-x-4 border-t border-border py-1.5"
          >
            <span className="[overflow-wrap:anywhere]">
              {l.name}
              {l.qty > 1 && <span className="num"> x{l.qty}</span>}
              {l.others > 0 && (
                <span className="block text-xs font-semibold text-brand-text">
                  Also on {l.others} other {l.others === 1 ? "cart" : "carts"}
                </span>
              )}
            </span>
            <span className="num">
              {l.price === null ? "Ask" : usd(l.price * l.qty)}
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}
