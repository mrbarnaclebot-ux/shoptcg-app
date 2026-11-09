export type Point = { date: string; market: number };

/**
 * Maps points into a w x h box (y grows down). The range is padded so a flat
 * line sits mid-chart instead of on an edge; `extra` (this table's price) is
 * included so its dashed line is always on the chart.
 */
export function scale(points: Point[], w: number, h: number, extra?: number) {
  const vals = points.map((p) => p.market).concat(extra ?? []);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo || hi || 1) * 0.1;
  const min = lo - pad;
  const max = hi + pad;
  const last = Math.max(1, points.length - 1);
  return {
    min,
    max,
    x: (i: number) => (points.length === 1 ? w / 2 : (i / last) * w),
    y: (v: number) => h - ((v - min) / (max - min)) * h,
  };
}

/** "Up 8% in 30 days": whole percent, first point to last. */
export function trend(points: Point[], days: number) {
  if (points.length < 2) return null;
  const first = points[0].market;
  const pct = Math.round(((points.at(-1)!.market - first) / first) * 100);
  if (pct === 0)
    return { dir: "flat" as const, text: `Flat over ${days} days` };
  const dir = pct > 0 ? ("up" as const) : ("down" as const);
  return {
    dir,
    text: `${pct > 0 ? "Up" : "Down"} ${Math.abs(pct)}% in ${days} days`,
  };
}
