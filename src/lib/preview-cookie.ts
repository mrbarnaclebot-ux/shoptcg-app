/**
 * Set by the dashboard's preview page in the browser, never by a link that
 * could be prefetched. It only counts for the signed-in owner of the store
 * being viewed (src/lib/preview.ts), so it needs no protection of its own.
 */
export const PREVIEW_COOKIE = "preview";
export const PREVIEW_COOKIE_ON = `${PREVIEW_COOKIE}=1; path=/; max-age=3600; samesite=lax`;
