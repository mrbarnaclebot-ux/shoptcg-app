import { getDb } from "@/db";
import { appUrl } from "@/lib/deployed";
import { uploadAllowed } from "@/lib/export-limit";
import { dropImage, putImage } from "@/lib/image-store";
import { storeOrNull } from "@/lib/session";
import {
  ImageError,
  isImageKind,
  MAX_IMAGE_BYTES,
  processImage,
} from "@/lib/store-image";
import { setStoreImage } from "@/lib/stores";

const fail = (status: number, error: string) =>
  Response.json({ error }, { status });

/** The signed-in vendor's store and the image slot asked for, or the refusal. */
async function authorize(req: Request) {
  // Route handlers get no CSRF check from Next, unlike server actions.
  if (req.headers.get("origin") !== appUrl().origin)
    return fail(403, "Wrong origin.");
  const store = await storeOrNull();
  if (!store) return fail(401, "Sign in again.");
  const kind = new URL(req.url).searchParams.get("kind");
  if (!isImageKind(kind)) return fail(400, "Unknown image.");
  return { store, kind };
}

/** The body, or null once it passes the cap: Content-Length can be missing or wrong. */
async function readCapped(req: Request) {
  if (Number(req.headers.get("content-length")) > MAX_IMAGE_BYTES) return null;
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Uploads the request body as the store's banner or profile image. */
export async function POST(req: Request) {
  const auth = await authorize(req);
  if (auth instanceof Response) return auth;
  const { store, kind } = auth;
  if (!uploadAllowed(store.id))
    return fail(429, "Too many uploads. Try again in an hour.");
  const body = await readCapped(req);
  if (!body) return fail(413, "That image is over 4 MB. Pick a smaller one.");
  try {
    const bytes = await processImage(kind, body);
    const image = await putImage(bytes, `${store.slug}-${kind}.webp`);
    const old = await setStoreImage(getDb(), store.id, kind, image);
    if (old !== image.fileId) await dropImage(old);
    return Response.json({ url: image.url });
  } catch (err) {
    if (err instanceof ImageError) return fail(422, err.message);
    console.error("[image] upload failed", err);
    return fail(502, "Couldn't save that image. Try again.");
  }
}

/** Removes the store's banner or profile image. */
export async function DELETE(req: Request) {
  const auth = await authorize(req);
  if (auth instanceof Response) return auth;
  const old = await setStoreImage(getDb(), auth.store.id, auth.kind, null);
  await dropImage(old);
  return Response.json({});
}
