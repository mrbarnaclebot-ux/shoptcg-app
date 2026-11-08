import { vi } from "vitest";
import type { PriceRef, SearchQuery } from "./provider";

// Serves fixtures by URL substring; anything unmatched is a 404.
export function serve(routes: [string, unknown][]) {
  const calls: URL[] = [];
  vi.stubGlobal("fetch", async (input: string) => {
    const url = new URL(input);
    calls.push(url);
    const hit = routes.find(([part]) => decodeURI(url.href).includes(part));
    return hit
      ? Response.json(hit[1])
      : new Response("not found", { status: 404 });
  });
  return calls;
}

export const query = (over: Partial<SearchQuery>): SearchQuery => ({
  text: "charizard 199",
  name: "charizard",
  number: "199",
  setTotal: null,
  kind: "raw",
  language: "en",
  limit: 10,
  ...over,
});

export const raw: PriceRef = {
  providerId: "517045",
  kind: "raw",
  language: "en",
  grader: null,
  grade: null,
};
