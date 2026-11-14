import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { putImage } from "@/lib/image-store";
import { ImageError, processImage, sniff } from "@/lib/store-image";

const photo = (
  width: number,
  height: number,
  format: "jpeg" | "png" | "webp",
) =>
  sharp({
    create: { width, height, channels: 3, background: "#c0572b" },
  })
    .withExif({ IFD0: { Copyright: "secret-owner" } })
    [format]()
    .toBuffer();

describe("processImage", () => {
  it("stores every allowed format as WebP at exactly the slot's size", async () => {
    for (const format of ["jpeg", "png", "webp"] as const) {
      const out = await processImage("banner", await photo(3000, 2000, format));
      const meta = await sharp(out).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual([
        "webp",
        1500,
        500,
      ]);
    }
    const avatar = await sharp(
      await processImage("avatar", await photo(600, 900, "png")),
    ).metadata();
    expect([avatar.width, avatar.height]).toEqual([400, 400]);
  });

  it("strips the original's metadata", async () => {
    const input = await photo(1600, 600, "jpeg");
    expect(input.includes("secret-owner")).toBe(true);
    const out = await processImage("banner", input);
    expect(out.includes("secret-owner")).toBe(false);
    expect((await sharp(out).metadata()).exif).toBeUndefined();
  });

  it("refuses what isn't a JPEG, PNG or WebP, whatever it is called", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const gif = await sharp({
      create: { width: 1600, height: 600, channels: 3, background: "#000" },
    })
      .gif()
      .toBuffer();
    const cutShort = (await photo(1600, 600, "png")).subarray(0, 200);
    for (const bad of [svg, gif, cutShort, Buffer.from("<html>")])
      await expect(processImage("banner", bad)).rejects.toBeInstanceOf(
        ImageError,
      );
  });

  it("refuses an image too small to fill the slot, or over 4 MB", async () => {
    await expect(
      processImage("avatar", await photo(150, 150, "png")),
    ).rejects.toThrow(/at least 200 x 200/);
    const huge = Buffer.concat([
      await photo(1600, 600, "jpeg"),
      Buffer.alloc(4 * 1024 * 1024),
    ]);
    await expect(processImage("banner", huge)).rejects.toThrow(/over 4 MB/);
  });
});

describe("sniff", () => {
  it("reads the type from the first bytes", async () => {
    expect(sniff(await photo(8, 8, "webp"))).toBe("webp");
    expect(sniff(Buffer.from("GIF89a"))).toBeNull();
    expect(sniff(new Uint8Array())).toBeNull();
  });
});

describe("putImage without Pinata", () => {
  it("keeps the bytes in a data URL locally, and refuses when deployed", async () => {
    const bytes = Buffer.from("abc");
    expect(await putImage(bytes, "x.webp", {})).toEqual({
      url: "data:image/webp;base64,YWJj",
      fileId: null,
    });
    await expect(
      putImage(bytes, "x.webp", { RAILWAY_ENVIRONMENT: "production" }),
    ).rejects.toBeInstanceOf(ImageError);
  });
});
