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
