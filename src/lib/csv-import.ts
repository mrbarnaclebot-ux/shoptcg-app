import { z } from "zod";
import type { CatalogItem } from "@/db/schema";
import { CONDITION_NAME } from "@/lib/condition";
import { parseCsv } from "@/lib/csv";
import { SearchError } from "@/lib/pricing/errors";
import {
  catalogListingSchema,
  customListingSchema,
  GRADERS,
  GRADES,
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
  "cost",
] as const;
export const MAX_ROWS = 1000;
export const MAX_CSV_CHARS = 1_000_000;

// Vendors write JP and CN, and other apps write the name; the catalog stores ISO codes.
const LANGUAGE_ALIASES: Record<string, string> = {
  jp: "ja",
  cn: "zh",
  english: "en",
  japanese: "ja",
  chinese: "zh",
};

// Headers TCGplayer and Collectr exports use, lower-cased. Their market and
// low prices ("TCG Market Price", "Price Each") are left out on purpose: a
// blank price follows our market, and copying theirs would fix it.
const HEADER_ALIASES: Record<string, (typeof CSV_COLUMNS)[number]> = {
  "product name": "name",
  "set name": "set",
  "card number": "number",
  quantity: "qty",
  "total quantity": "qty",
  "add to quantity": "qty",
  "my price": "price",
};

/** "Near Mint", or TCGplayer's "Lightly Played Foil", as NM or LP; anything else as typed. */
function conditionCode(v: string) {
  const text = v.trim().toLowerCase();
  const hit = Object.entries(CONDITION_NAME).find(([, name]) =>
    text.startsWith(name.toLowerCase()),
  );
  return hit ? hit[0] : v;
}

/** Each header as one of our columns; our own name wins, then the first alias. */
function columnsOf(head: string[]) {
  const cols = head.map((c) => c.trim().toLowerCase());
  const taken = new Set(cols);
  return cols.map((c) => {
    const ours = HEADER_ALIASES[c];
    if (!ours || taken.has(ours)) return c;
    taken.add(ours);
    return ours;
  });
}

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
    condition: kind === "raw" ? conditionCode(cells.condition || "NM") : null,
    grader: cells.grader?.toUpperCase(),
    grade: cells.grade,
    qty: cells.qty?.trim() || 1,
    overridePrice: cells.price,
    cost: cells.cost,
    // The export writes "yes" for hidden stock, so a round trip keeps it hidden.
    active: !/^(yes|y|true|1|x|hidden)$/i.test(cells.hidden?.trim() ?? ""),
  });
}

/** Parses and validates a CSV export. Throws a readable Error for file-level problems. */
export function readCsv(text: string): ParsedRow[] {
  if (text.length > MAX_CSV_CHARS)
    throw new Error("That file is too big. Keep it under 1 MB.");
  const [head, ...body] = parseCsv(text);
  if (!head) throw new Error("The file is empty.");
  const cols = columnsOf(head.cells);
  if (!cols.includes("name"))
    throw new Error(
      `The first row must be the column names, including "name" (or "Product Name").`,
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
  // A slab matches its raw card (graded search returns those); the grade must
  // be one the catalog can hold, or it stays custom (e.g. ACE, TAG).
  if (input.kind === "graded" && !slab(input)) return null;
  const kind = input.kind === "graded" ? "raw" : input.kind;
  const wanted = hits.filter(
    (h) =>
      h.kind === kind &&
      h.language === input.language &&
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
  const { qty, condition, overridePrice, cost, active } = input;
  const { grader, grade } = slab(input) ?? { grader: null, grade: null };
  return {
    kind: "catalog",
    input: {
      catalogItemId: match.id,
      grader,
      grade,
      qty,
      condition,
      overridePrice,
      cost,
      active,
    },
  };
}

/** The grader and grade if this is a slab the catalog can hold, else null. */
function slab(input: CustomListingInput) {
  const grader = GRADERS.find((g) => g === input.grader);
  const grade = input.grade ?? "";
  if (input.kind !== "graded" || !grader || !GRADES.includes(grade))
    return null;
  return { grader, grade };
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
  // No price source covers Chinese products or non-card items, so they are always custom.
  if (input.language === "zh" || input.kind === "other")
    return { match: null, note: null };
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
