import { metaLine } from "@/app/[slug]/tile";
import { CardThumb } from "@/components/card-thumb";
import { usd, withLanguage } from "@/lib/format";
import type { Line } from "@/lib/request-reads";

/** A request's lines and total, on either ticket. */
export function RequestLines({ lines }: { lines: Line[] }) {
  const items = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((n, l) => n + l.price * l.qty, 0);
  return (
    <>
      <ul className="mt-3.5 mb-3 text-sm">
        {lines.map((l) => (
          <li
            key={l.listingId}
            className="grid grid-cols-[34px_1fr_auto] items-center gap-2.5 border-t border-border py-1.5"
          >
            <CardThumb
              src={l.imageUrl}
              kind={l.kind}
              number={l.number}
              className="w-[34px]"
            />
            <span className="min-w-0">
              {l.name}
              <small className="block text-sm text-muted-foreground">
                {withLanguage(metaLine(l), l.language)}
              </small>
            </span>
            <span className="num">
              {l.qty} x {usd(l.price)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between border-t-[1.5px] border-text pt-2 font-semibold">
        <span>
          {items} {items === 1 ? "item" : "items"}
        </span>
        <span className="font-display num text-[1.875rem] leading-none font-extrabold">
          {usd(total)}
        </span>
      </div>
    </>
  );
}
