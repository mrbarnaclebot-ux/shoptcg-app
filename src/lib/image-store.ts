import { isDeployed } from "@/lib/deployed";
import { gatewayHost } from "@/lib/pricing/images";
import { ImageError } from "@/lib/store-image";

type Env = Record<string, string | undefined>;
export type StoredImage = { url: string; fileId: string | null };

const UPLOAD = "https://uploads.pinata.cloud/v3/files";
const FILES = "https://api.pinata.cloud/v3/files/public";

function pinata(env: Env) {
  const jwt = env.PINATA_JWT;
  const host = gatewayHost(env);
  return jwt && host ? { jwt, host } : null;
}

/**
 * Stores processed image bytes on Pinata and returns the public URL. The URL
 * holds the content hash, so it never changes and can be cached forever.
 */
export async function putImage(
  bytes: Uint8Array,
  name: string,
  env: Env = process.env,
): Promise<StoredImage> {
  const p = pinata(env);
  if (!p) {
    if (isDeployed(env))
      throw new ImageError("Image uploads aren't set up yet.");
    // ponytail: local dev and e2e have no Pinata key, so the image rides in
    // the row as a data URL. Never on a deployed service.
    const b64 = Buffer.from(bytes).toString("base64");
    return { url: `data:image/webp;base64,${b64}`, fileId: null };
  }
  const form = new FormData();
  form.set("network", "public");
  form.set(
    "file",
    new Blob([Buffer.from(bytes)], { type: "image/webp" }),
    name,
  );
  const res = await fetch(UPLOAD, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.jwt}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Pinata upload ${res.status}`);
  const { data } = (await res.json()) as { data: { id: string; cid: string } };
  return { url: `https://${p.host}/ipfs/${data.cid}`, fileId: data.id };
}

/** Unpins a replaced or removed image. Best effort: a leftover file is not worth failing a save. */
export async function dropImage(fileId: string | null, env: Env = process.env) {
  const p = pinata(env);
  if (!p || !fileId) return;
  try {
    const res = await fetch(`${FILES}/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${p.jwt}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.error(`[image] Pinata delete ${res.status}`, fileId);
  } catch (err) {
    console.error("[image] Pinata delete failed", fileId, err);
  }
}
