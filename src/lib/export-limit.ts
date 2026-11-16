const WINDOW_MS = 60 * 60_000;

/**
 * A per-store hourly counter: the returned function is true, and counts the
 * call, while the store is under `max` an hour.
 * ponytail: in memory, so per process and reset on deploy; move to the DB if scaled out.
 */
export function hourlyLimit(max: number) {
  const hits = new Map<string, number[]>();
  return (storeId: string, now = Date.now()) => {
    const recent = (hits.get(storeId) ?? []).filter((t) => now - t < WINDOW_MS);
    const ok = recent.length < max;
    hits.set(storeId, ok ? [...recent, now] : recent);
    return ok;
  };
}

/** True and counts the export if this vendor is under 30 an hour. */
export const exportAllowed = hourlyLimit(30);
/** Image uploads cost a re-encode and a stored file, so 20 an hour. */
export const uploadAllowed = hourlyLimit(20);
/** Item photos: a vendor may add a shelf of them in one go. */
export const photoAllowed = hourlyLimit(60);
