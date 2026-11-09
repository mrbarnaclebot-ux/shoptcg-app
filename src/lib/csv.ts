/**
 * RFC 4180 CSV: quoted fields, "" escapes, commas and newlines inside quotes,
 * CRLF or LF. Blank lines are dropped. Each row keeps its 1-based start line so
 * errors can point at the spreadsheet row the vendor sees. Throws when a row has
 * more than MAX_COLS cells, so a line of commas cannot balloon memory.
 */
export const MAX_COLS = 50;

export function parseCsv(text: string): { line: number; cells: string[] }[] {
  const rows: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let start = 1;
  const src = text.replace(/^﻿/, "");
  const endRow = () => {
    cells.push(cell);
    if (cells.some((c) => c.trim())) rows.push({ line: start, cells });
    [cells, cell] = [[], ""];
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') [cell, i] = [cell + '"', i + 1];
      else if (ch === '"') quoted = false;
      else {
        if (ch === "\n") line++;
        cell += ch;
      }
    } else if (ch === '"' && !cell) quoted = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
      if (cells.length >= MAX_COLS)
        throw new Error(`Row ${start} has more than ${MAX_COLS} columns.`);
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      endRow();
      start = ++line;
    } else cell += ch;
  }
  if (cell || cells.length) endRow();
  return rows;
}

// A spreadsheet runs these as formulas, with or without leading spaces, and
// some read the full-width forms too. Excel with a semicolon list separator
// splits a line on ";", so what follows one is the start of a cell as well.
const FORMULA = /(^|;)(?=[\s　]*[=+\-@＝＋－＠])/g;

type Cell = string | number | null | undefined;

/** One cell, safe to open in Excel: formulas neutralised, then RFC 4180 quoted. */
export function csvCell(value: Cell) {
  const text = String(value ?? "");
  const safe = (/^[\t\r]/.test(text) ? `'${text}` : text).replace(
    FORMULA,
    "$1'",
  );
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** UTF-8 BOM (so Excel reads accents), CRLF line ends. */
export const toCsv = (rows: Cell[][]) =>
  "﻿" + rows.map((r) => r.map(csvCell).join(",") + "\r\n").join("");

/** A download of these rows; the first is the header, so it isn't counted. */
export const csvResponse = (filename: string, rows: Cell[][]) =>
  new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Row-Count": String(rows.length - 1),
    },
  });
