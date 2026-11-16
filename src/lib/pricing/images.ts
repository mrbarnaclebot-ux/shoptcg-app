// Card art hosts: TCGdex (default dev catalog) and the TCGplayer CDN that PPT returns.
// next.config.ts allows the same list for next/image.
export const IMAGE_HOSTS = ["assets.tcgdex.net", "tcgplayer-cdn.tcgplayer.com"];

/** True for art next/image may optimise (the hosts above). */
export const isCardArt = (url: string) =>
  url.startsWith("https://") &&
  URL.canParse(url) &&
  IMAGE_HOSTS.includes(new URL(url).hostname);

/** The Pinata gateway's host from "name.mypinata.cloud" or a full URL. */
export const gatewayHost = (env: Record<string, string | undefined>) =>
  env.PINATA_GATEWAY_URL?.replace(/^https?:\/\//, "").replace(/\/.*$/, "") ||
  null;

/**
 * A vendor photo we stored: on the Pinata gateway, or a WebP data URL where
 * there is no Pinata (local and e2e; putImage refuses that when deployed).
 * Only our upload writes either, since typed image links must be https.
 */
export function ownPhotoUrl(
  url: string | null,
  env: Record<string, string | undefined> = process.env,
) {
  if (!url) return null;
  if (url.startsWith("data:image/webp;base64,")) return url;
  const host = gatewayHost(env);
  return host && url.startsWith(`https://${host}/ipfs/`) ? url : null;
}

/** The URL if it is https on an allowed host, else null. */
export function safeImageUrl(url: string | null | undefined): string | null {
  if (!url || !URL.canParse(url)) return null;
  const u = new URL(url);
  return u.protocol === "https:" && IMAGE_HOSTS.includes(u.hostname)
    ? u.href
    : null;
}
