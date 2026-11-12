// The request-code alphabet: no 0/O, 1/I/L or U, so it reads aloud cleanly.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export const DEVICE_ID = /^[0-9a-f]{32}$/;

/**
 * "K7P": three characters from a device id, the same in the buyer's browser
 * and on the vendor's screen, so a vendor can match a list to the person in
 * front of them. About 27,000 values, so two at one table rarely collide.
 */
export function basketTag(deviceId: string) {
  return [0, 4, 8]
    .map((i) => ALPHABET[parseInt(deviceId.slice(i, i + 4), 16) % 30])
    .join("");
}
