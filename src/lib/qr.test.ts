import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { qr } from "@/lib/qr";

/** Rasterises the module grid at 8 px per module, as a scanner would see it. */
function decode(data: boolean[][], size: number) {
  const px = 8;
  const w = size * px;
  const rgba = new Uint8ClampedArray(w * w * 4);
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++) {
      const v = data[Math.floor(y / px)][Math.floor(x / px)] ? 0 : 255;
      rgba.set([v, v, v, 255], (y * w + x) * 4);
    }
  return jsQR(rgba, w, w)?.data;
}

describe("qr", () => {
  it("decodes back to the exact sign URL", () => {
    const url = "https://tcgmart.app/ridgeline-cards?src=sign";
    const { data, size, d } = qr(url);
    expect(decode(data, size)).toBe(url);
    expect(d.startsWith("M4 4h1v1h-1z")).toBe(true);
  });
});
