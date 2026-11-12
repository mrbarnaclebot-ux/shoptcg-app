import { SearchBusyError } from "./errors";
import type { CatalogHit, PriceProvider } from "./provider";

// The search provider in e2e builds (E2E_SEED=1, never deployed), so specs
// never reach TCGdex or PPT. Same provider name as the demo seed, so seeded
// rows are its cache. "zard" is also seeded: the merge must show it once.
const CARDS: [string, string, string, string][] = [
  ["zard", "Charizard ex", "151", "199"],
  ["zard-base", "Charizard", "Base Set", "4"],
  ["zard-obf", "Charizard ex", "Obsidian Flames", "125"],
  ["mew-151", "Mew", "151", "151"],
];

const hit = ([id, name, setName, number]: (typeof CARDS)[number]) =>
  ({
    provider: "e2e",
    providerId: id,
    kind: "raw",
    language: "en",
    name,
    setName,
    number,
    imageUrl: null,
    grader: null,
    grade: null,
  }) satisfies CatalogHit;

export const e2eProvider: PriceProvider = {
  name: "e2e",
  async search(q) {
    // Slow enough that the cached answer visibly comes first.
    await new Promise((r) => setTimeout(r, 800));
    const text = q.text.toLowerCase();
    if (text.includes("busy"))
      throw new SearchBusyError("Price search is busy. Try again in a minute.");
    if (text.includes("down")) throw new Error("e2e provider down");
    if (q.kind !== "raw" || q.language !== "en") return [];
    const ws = text.split(/\s+/);
    return CARDS.map(hit).filter((h) => {
      const hay = `${h.name} ${h.setName} ${h.number}`.toLowerCase();
      return ws.every((w) => hay.includes(w));
    });
  },
  getPrices: async () => [],
  getHistory: async () => [],
};
