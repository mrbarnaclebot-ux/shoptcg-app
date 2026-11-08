// Card art hosts: TCGdex (default dev catalog) and the TCGplayer CDN that PPT returns.
// next.config.ts allows the same list for next/image.
export const IMAGE_HOSTS = ["assets.tcgdex.net", "tcgplayer-cdn.tcgplayer.com"];

/** The URL if it is https on an allowed host, else null. */
export function safeImageUrl(url: string | null | undefined): string | null {
  if (!url || !URL.canParse(url)) return null;
  const u = new URL(url);
  return u.protocol === "https:" && IMAGE_HOSTS.includes(u.hostname)
    ? u.href
    : null;
}
