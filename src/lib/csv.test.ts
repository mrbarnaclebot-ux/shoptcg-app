import { describe, expect, it } from "vitest";
import { csvCell, parseCsv, toCsv } from "./csv";

describe("csvCell", () => {
  it.each([
    '=HYPERLINK("http://evil","x")',
    "+1",
    "-2",
    "@SUM(A1)",
    "\tcmd",
    "\rcmd",
    "   =1+1",
    "　=1",
    "＝1+1",
    "＠SUM(A1)",
  ])("neutralises %j", (v) => {
    const [{ cells }] = parseCsv(`${csvCell(v)},x`);
    expect(cells[0]).toBe(`'${v}`);
  });

  it("neutralises a formula after a semicolon", () => {
    expect(csvCell("x;=cmd|'/Ccalc'!A0;")).toBe("x;'=cmd|'/Ccalc'!A0;");
    expect(csvCell("=1;+2")).toBe("'=1;'+2");
    expect(csvCell("Maya; Theo")).toBe("Maya; Theo");
  });

  it.each(["Maya", "12.50", "R-0001", "Pikachu ex", "a=b", "2026-11-09", ""])(
    "leaves %j alone",
    (v) => expect(csvCell(v)).toBe(v),
  );

  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(3)).toBe("3");
    // A typed number is never a formula: a stock move of -1 stays a number.
    expect(csvCell(-1)).toBe("-1");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell(null)).toBe("");
  });
});

it("toCsv has a BOM and CRLF, and parses back to the same cells", () => {
  const rows = [
    ["name", "note"],
    ["Maya, R", 'said "hi"\nthen left'],
  ];
  const text = toCsv(rows);
  expect(text.startsWith("﻿")).toBe(true);
  expect(text.endsWith("\r\n")).toBe(true);
  expect(parseCsv(text).map((r) => r.cells)).toEqual(rows);
});
