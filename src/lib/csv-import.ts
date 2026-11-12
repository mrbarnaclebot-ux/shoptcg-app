import { z } from "zod";
import type { CatalogItem } from "@/db/schema";
import { parseCsv } from "@/lib/csv";
import { SearchError } from "@/lib/pricing/errors";
import {
  catalogListingSchema,
  customListingSchema,
  type CustomListingInput,
} from "@/lib/listing-input";
import type { ImportRow } from "@/lib/listings";

export const CSV_COLUMNS = [
  "name",
  "set",
  "number",
  "language",
  "kind",
  "condition",
  "grader",
  "grade",
  "qty",
  "price",
] as const;
export const MAX_ROWS = 1000;
export const MAX_CSV_CHARS = 1_000_000;

// Vendors write JP and CN; the catalog stores ISO codes.
const LANGUAGE_ALIASES: Record<string, string> = { jp: "ja", cn: "zh" };

export type ParsedRow =
  | { line: number; ok: true; input: CustomListingInput }
  | { line: number; ok: false; error: string };

function toInput(cells: Record<string, string>) {
  const kind = (cells.kind || "raw").trim().toLowerCase();
  const lang = (cells.language || "en").trim().toLowerCase();
  return customListingSchema.safeParse({
    name: cells.name,
    setName: cells.set,
    number: cells.number,
    kind,
    language: LANGUAGE_ALIASES[lang] ?? lang,
    // A raw row with no condition is the common case: assume Near Mint.
    condition: kind === "raw" ? cells.condition || "NM" : null,
    grader: cells.grader?.toUpperCase(),
    grade: cells.grade,
    qty: cells.qty?.trim() || 1,
    overridePrice: cells.price,
    cost: cells.cost,
  });
}

/** Parses and validates a CSV export. Throws a readable Error for file-level problems. */
export function readCsv(text: string): ParsedRow[] {
  if (text.length > MAX_CSV_CHARS)
    throw new Error("That file is too big. Keep it under 1 MB.");
  const [head, ...body] = parseCsv(text);
  if (!head) throw new Error("The file is empty.");
  const cols = head.cells.map((c) => c.trim().toLowerCase());
  if (!cols.includes("name"))
    throw new Error(
      `The first row must be the column names, including "name".`,
    );
  if (body.length > MAX_ROWS)
    throw new Error(
      `That file has ${body.length} rows. The limit is ${MAX_ROWS}; split it and import twice.`,
    );
  return body.map(({ line, cells }) => {
    const byCol = Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
    const res = toInput(byCol);
    if (res.success) return { line, ok: true, input: res.data };
    const issue = res.error.issues[0];
    return {
      line,
      ok: false,
      error: `${String(issue.path[0] ?? "row")}: ${issue.message}`,
    };
  });
}

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/^0+(?=\d)/, "");

/**
 * The single catalog hit this row describes, or null. Ambiguity is never
 * guessed: two candidates make the row a custom item the vendor can fix later.
 */
export function pickMatch(input: CustomListingInput, hits: CatalogItem[]) {
  const wanted = hits.filter(
    (h) =>
      h.kind === input.kind &&
      h.language === input.language &&
      (h.grader ?? null) === (input.kind === "graded" ? input.grader : null) &&
      (h.grade ?? null) === (input.kind === "graded" ? input.grade : null) &&
      (!input.setName || norm(h.setName) === norm(input.setName)) &&
      (!input.number ||
        norm(h.number?.split("/")[0]) === norm(input.number.split("/")[0])),
  );
  return wanted.length === 1 ? wanted[0] : null;
}

/** The searchable text for a row: name plus card number, as typed in the search box. */
export function searchText(input: CustomListingInput) {
  return [input.name, input.number].filter(Boolean).join(" ");
}

export function toImportRow(
  input: CustomListingInput,
  match: CatalogItem | null,
): ImportRow {
  if (!match) return { kind: "custom", input };
  const { qty, condition, overridePrice, cost } = input;
  return {
    kind: "catalog",
    input: { catalogItemId: match.id, qty, condition, overridePrice, cost },
  };
}

/** What the confirm step accepts back from the browser; validated again on the server. */
export const importRowsSchema = z
  .array(
    z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("catalog"), input: catalogListingSchema }),
      z.object({ kind: z.literal("custom"), input: customListingSchema }),
    ]),
  )
  .min(1)
  .max(MAX_ROWS);

export type PreviewRow = {
  line: number;
  status: "matched" | "custom" | "error";
  name: string;
  detail: string;
  imageUrl: string | null;
  note: string | null;
  row: ImportRow | null;
};

type Search = (input: CustomListingInput) => Promise<CatalogItem[]>;

async function previewOne(input: CustomListingInput, search: Search) {
  // No price source covers Chinese products, so they are always custom.
  if (input.language === "zh") return { match: null, note: null };
  try {
    return { match: pickMatch(input, await search(input)), note: null };
  } catch (err) {
    // The search limit is worth telling the vendor; anything else is logged.
    if (err instanceof SearchError) return { match: null, note: err.message };
    console.error("[csv] search failed", err);
    return { match: null, note: "Search failed, added as custom" };
  }
}

/** Resolves each valid row to a catalog match or a custom item. Sequential to respect provider limits. */
export async function previewRows(
  rows: ParsedRow[],
  search: Search,
): Promise<PreviewRow[]> {
  const out: PreviewRow[] = [];
  for (const r of rows) {
    if (!r.ok) {
      out.push({
        line: r.line,
        status: "error",
        name: "",
        detail: "",
        imageUrl: null,
        note: r.error,
        row: null,
      });
      continue;
    }
    const { match, note } = await previewOne(r.input, search);
    const src = match ?? r.input;
    out.push({
      line: r.line,
      status: match ? "matched" : "custom",
      name: src.name,
      detail: [src.setName, src.number].filter(Boolean).join(" "),
      imageUrl: match?.imageUrl ?? null,
      note,
      row: toImportRow(r.input, match),
    });
  }
  return out;
}
