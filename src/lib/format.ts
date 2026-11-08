const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const usd = (n: number) => usdFmt.format(n);

/** "Nov 7" from an ISO date, read as UTC so the day never shifts by timezone. */
export function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Whole days between two ISO dates. */
export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

export const LANGUAGE_LABEL = { en: "EN", ja: "JP", zh: "CN" } as const;

/** "NM", "PSA 10" or "Sealed": the one-word state of a listing. */
export function gradeLabel(r: {
  kind: string;
  condition: string | null;
  grader: string | null;
  grade: string | null;
}) {
  if (r.kind === "graded") return [r.grader, r.grade].filter(Boolean).join(" ");
  if (r.kind === "sealed") return "Sealed";
  return r.condition ?? "";
}

/** "4417 0932": a stable cert-style number for a listing, derived from its id. */
export function certNo(id: string) {
  const n = parseInt(id.replace(/-/g, "").slice(0, 8), 16) % 1e8;
  const s = String(n).padStart(8, "0");
  return `${s.slice(0, 4)} ${s.slice(4)}`;
}
