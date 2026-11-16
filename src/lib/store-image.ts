import sharp from "sharp";

/** The two images a store can show, and the exact size each is stored at. */
export const IMAGE_SIZE = {
  banner: { width: 1500, height: 500 },
  // Shown at 112 px at most, so 400 covers a 3x screen.
  avatar: { width: 400, height: 400 },
} as const;
export type ImageKind = keyof typeof IMAGE_SIZE;
export const isImageKind = (v: unknown): v is ImageKind =>
  v === "banner" || v === "avatar";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
// A 48 MP phone photo fits; a decompression bomb does not.
const MAX_PIXELS = 50_000_000;

/** A problem with the file itself; the message is safe to show the vendor. */
export class ImageError extends Error {}

const WRONG_TYPE = "Use a JPEG, PNG or WebP image.";

/** The format by its first bytes; the browser's MIME type and file name are never trusted. */
export function sniff(b: Uint8Array) {
  const at = (i: number, ...bytes: number[]) =>
    bytes.every((v, j) => b[i + j] === v);
  if (at(0, 0xff, 0xd8, 0xff)) return "jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  // "RIFF" .... "WEBP"
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50))
    return "webp";
  return null;
}

/** Decodes an upload whose first bytes and decoded format agree. */
async function decode(input: Uint8Array) {
  if (input.byteLength > MAX_IMAGE_BYTES)
    throw new ImageError("That image is over 4 MB. Pick a smaller one.");
  const format = sniff(input);
  if (!format) throw new ImageError(WRONG_TYPE);
  const image = sharp(input, { limitInputPixels: MAX_PIXELS });
  const meta = await image.metadata();
  if (meta.format !== format) throw new ImageError(WRONG_TYPE);
  return { image, width: meta.width ?? 0, height: meta.height ?? 0 };
}

// An item photo shows whole (sleeves, boxes, die-cast are any shape), so it
// keeps its shape. 800 covers the item page's 420 px at 2x.
const PHOTO_MAX = 800;
const PHOTO_MIN = 200;

/**
 * A vendor's photo of an item, re-encoded as WebP at most 800 px a side. Like
 * processImage, only our encoder's output is kept, so metadata is gone.
 */
export async function processPhoto(input: Uint8Array) {
  try {
    const { image, width, height } = await decode(input);
    if (width < PHOTO_MIN || height < PHOTO_MIN)
      throw new ImageError(
        `That photo is too small. Use at least ${PHOTO_MIN} x ${PHOTO_MIN} pixels.`,
      );
    return await image
      .rotate()
      .resize(PHOTO_MAX, PHOTO_MAX, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (err) {
    if (err instanceof ImageError) throw err;
    throw new ImageError("We couldn't read that image. Try another file.");
  }
}

/**
 * Decodes the upload and re-encodes it as WebP at exactly the stored size,
 * cropped around the centre. Only our own encoder's output is ever stored, so
 * EXIF and GPS data, and anything hidden in the original file, are gone.
 */
export async function processImage(kind: ImageKind, input: Uint8Array) {
  const { width, height } = IMAGE_SIZE[kind];
  try {
    const { image, ...got } = await decode(input);
    // Half size still looks fine on a phone; smaller would be stretched to blur.
    if (got.width < width / 2 || got.height < height / 2)
      throw new ImageError(
        `That image is too small. Use at least ${width / 2} x ${height / 2} pixels.`,
      );
    // rotate() applies the camera's orientation before it is stripped.
    const sized = image.rotate().resize(width, height, { fit: "cover" });
    // A see-through banner would show the page through it.
    const flat =
      kind === "banner" ? sized.flatten({ background: "#090911" }) : sized;
    return await flat.webp({ quality: 82 }).toBuffer();
  } catch (err) {
    if (err instanceof ImageError) throw err;
    throw new ImageError("We couldn't read that image. Try another file.");
  }
}
