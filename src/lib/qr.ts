import { encode } from "uqr";

/**
 * QR for the printed sign: error correction M (survives a scuffed or taped
 * corner) and the standard 4-module quiet zone. Returns the module grid and
 * one SVG path of the dark modules, drawn in a size x size viewBox.
 */
export function qr(url: string) {
  const { data, size } = encode(url, { ecc: "M", border: 4 });
  let d = "";
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) d += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return { data, size, d };
}
