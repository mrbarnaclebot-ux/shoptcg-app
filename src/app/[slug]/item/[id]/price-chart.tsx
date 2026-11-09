import { cn } from "cn";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { shortDate, usd } from "@/lib/format";
import { scale, trend, type Point } from "./chart-scale";

const W = 320;
const H = 160;
const ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight };

/**
 * Server-rendered market line with this table's price dashed across it. No
 * chart library and no JS: hover titles per point, a text summary, and a
 * visually hidden table for screen readers.
 */
export function PriceChart(props: {
  points: Point[];
  days: number;
  price: number | null;
}) {
  const { points, days, price } = props;
  if (points.length < 3)
    return (
      <p className="py-6 text-muted-foreground">
        Not enough price history yet. We&apos;ll have more after a few nightly
        syncs.
      </p>
    );
  const s = scale(points, W, H, price ?? undefined);
  const line = points.map((p, i) => `${s.x(i)},${s.y(p.market)}`).join(" ");
  const ticks = [s.max, (s.max + s.min) / 2, s.min];
  const t = trend(points, days)!;
  const Icon = ICON[t.dir];
  const mid = points[Math.floor((points.length - 1) / 2)];
  return (
    <figure className="flex flex-col gap-2">
      <p
        className={cn(
          "flex items-center gap-1 font-semibold",
          t.dir === "up" && "text-success",
          t.dir === "down" && "text-danger",
        )}
      >
        <Icon aria-hidden className="size-4" strokeWidth={2.4} />
        {t.text}
      </p>
      <div className="grid grid-cols-[auto_1fr] gap-x-2">
        <div
          aria-hidden
          className="num flex flex-col justify-between text-xs text-muted-foreground"
        >
          {ticks.map((v) => (
            <span key={v}>{usd(v)}</span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden
          className="h-40 w-full overflow-visible"
        >
          <polygon
            points={`0,${H} ${line} ${W},${H}`}
            className="fill-[color-mix(in_oklch,var(--seal)_14%,transparent)]"
          />
          <polyline
            points={line}
            fill="none"
            stroke="var(--seal)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {price !== null && (
            <line
              x1="0"
              x2={W}
              y1={s.y(price)}
              y2={s.y(price)}
              stroke="var(--brand)"
              strokeWidth="2"
              strokeDasharray="6 5"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {points.map((p, i) => (
            <rect
              key={p.date}
              x={s.x(i) - W / points.length / 2}
              width={W / points.length}
              y="0"
              height={H}
              fill="transparent"
            >
              <title>{`${shortDate(p.date)}: ${usd(p.market)}`}</title>
            </rect>
          ))}
        </svg>
        <span />
        <div
          aria-hidden
          className="num mt-1 flex justify-between text-xs text-muted-foreground"
        >
          <span>{shortDate(points[0].date)}</span>
          <span>{shortDate(mid.date)}</span>
          <span>{shortDate(points.at(-1)!.date)}</span>
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Market price, daily. Source: public sales data.</span>
        {price !== null && (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="w-5 border-t-2 border-dashed border-brand"
            />
            This table {usd(price)}
          </span>
        )}
      </figcaption>
      <table className="sr-only">
        <caption>Market price by day</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <th scope="row">{shortDate(p.date)}</th>
              <td>{usd(p.market)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
