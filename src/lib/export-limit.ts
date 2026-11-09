const MAX = 30;
const WINDOW_MS = 60 * 60_000;
const hits = new Map<string, number[]>();

/**
 * True and counts the export if this vendor is under 30 an hour.
 * ponytail: in memory, so per process and reset on deploy; move to the DB if scaled out.
 */
export function exportAllowed(storeId: string, now = Date.now()) {
  const recent = (hits.get(storeId) ?? []).filter((t) => now - t < WINDOW_MS);
  const ok = recent.length < MAX;
  hits.set(storeId, ok ? [...recent, now] : recent);
  return ok;
}
