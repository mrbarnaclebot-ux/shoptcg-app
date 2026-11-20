import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { CatalogItem } from "@/db/schema";
import { parseCsv } from "@/lib/csv";
import { pickMatch, previewRows, readCsv, toImportRow } from "@/lib/csv-import";
import { SearchError } from "@/lib/pricing/errors";

const HEAD = "name,set,number,language,kind,condition,grader,grade,qty,price";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF, BOM and blank lines", () => {
    const text = '﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n"multi\nline",2\n';
    expect(parseCsv(text)).toEqual([
      { line: 1, cells: ["a", "b"] },
      { line: 2, cells: ["x, y", 'say "hi"'] },
      { line: 4, cells: ["multi\nline", "2"] },
    ]);
  });

  it("keeps a last row with no trailing newline and empty cells", () => {
    expect(parseCsv("a,,c")).toEqual([{ line: 1, cells: ["a", "", "c"] }]);
  });
});

describe("readCsv", () => {
  it("validates rows and applies defaults", () => {
    const rows = readCsv(
      [
        HEAD,
        "Charizard ex,151,199/165,EN,raw,,,,2,42.50",
        "Mew ex,151,205,en,graded,,cgc,9.5,1,",
        "Booster box,Shiny Treasure,,JP,sealed,,,,1,$120",
        ",151,1,en,raw,NM,,,1,",
        "Pikachu,,,en,raw,MINT,,,1,",
        "Pikachu,,,en,raw,NM,,,-2,",
        "Pikachu,,,en,raw,NM,,,1,abc",
        "Slab,,,en,graded,,,,1,",
      ].join("\n"),
    );
    expect(rows.slice(0, 3)).toMatchObject([
      { ok: true, input: { condition: "NM", qty: 2, overridePrice: "42.50" } },
      { ok: true, input: { grader: "CGC", grade: "9.5", condition: null } },
      { ok: true, input: { language: "ja", overridePrice: "120.00" } },
    ]);
    expect(rows.slice(3).map((r) => r.ok)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(rows[3]).toMatchObject({
      line: 5,
      error: expect.stringMatching(/^name/),
    });
  });

  it("reads a TCGplayer export's headers and condition names", () => {
    const rows = readCsv(
      [
        "TCGplayer Id,Product Line,Set Name,Product Name,Number,Rarity,Condition,TCG Market Price,Total Quantity,Add to Quantity,TCG Marketplace Price",
        "123,Pokemon,Scarlet & Violet 151,Charizard ex,199/165,SIR,Near Mint,291.77,2,0,299.99",
        "124,Pokemon,Scarlet & Violet 151,Mew ex,205/165,SIR,Lightly Played Holofoil,40.10,1,0,",
      ].join("\n"),
    );
    expect(rows).toMatchObject([
      {
        ok: true,
        input: {
          name: "Charizard ex",
          setName: "Scarlet & Violet 151",
          number: "199/165",
          condition: "NM",
          // Total Quantity comes first, so Add to Quantity is ignored.
          qty: 2,
          // Their market and listed prices are not ours.
          overridePrice: null,
        },
      },
      { ok: true, input: { name: "Mew ex", condition: "LP", qty: 1 } },
    ]);
  });

  it("reads a collection export: Quantity, Card Number, language names, My Price", () => {
    const rows = readCsv(
      [
        "Quantity,Product Name,Set,Card Number,Condition,Language,Price Each,My Price",
        "3,Pikachu,Shiny Treasure ex,236/190,Moderately Played,Japanese,30.00,",
        "1,Umbreon ex,Prismatic Evolutions,161,Damaged,English,1.00,450",
      ].join("\n"),
    );
    expect(rows).toMatchObject([
      {
        ok: true,
        input: {
          name: "Pikachu",
          setName: "Shiny Treasure ex",
          number: "236/190",
          qty: 3,
          condition: "MP",
          language: "ja",
          overridePrice: null,
        },
      },
      {
        ok: true,
        input: { condition: "DMG", language: "en", overridePrice: "450.00" },
      },
    ]);
  });

  it("prefers our own column to an alias of it", () => {
    const [row] = readCsv("name,Product Name,qty,Quantity\nOurs,Theirs,4,9");
    expect(row).toMatchObject({ ok: true, input: { name: "Ours", qty: 4 } });
  });

  it("accepts every row of the downloadable template", () => {
    const rows = readCsv(readFileSync("public/inventory-template.csv", "utf8"));
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.filter((r) => !r.ok)).toEqual([]);
  });

  it("rejects files without a header or over the row limit", () => {
    expect(() => readCsv("")).toThrow(/empty/);
    expect(() => readCsv("foo,bar\n1,2")).toThrow(/name/);
    const big = [HEAD, ...Array(1001).fill("a,,,en,raw,NM,,,1,")].join("\n");
    expect(() => readCsv(big)).toThrow(/1000/);
  });

  it("rejects a line of commas fast instead of copying per cell", () => {
    const t = Date.now();
    expect(() =>
      readCsv(`${HEAD}
${",".repeat(999_000)}`),
    ).toThrow(/50 columns/);
    expect(() => readCsv("x".repeat(1_000_001))).toThrow(/1 MB/);
    expect(Date.now() - t).toBeLessThan(500);
  });
});

const item = (over: Partial<CatalogItem>): CatalogItem => ({
  id: "c1",
  provider: "fake",
  providerId: "p",
  kind: "raw",
  language: "en",
  name: "Charizard ex",
  setName: "151",
  number: "199/165",
  imageUrl: null,
  grader: null,
  grade: null,
  updatedAt: new Date(),
  ...over,
});

describe("matching", () => {
  const [row] = readCsv(`${HEAD}\nCharizard ex,151,199,en,raw,NM,,,1,`);
  const input = row.ok ? row.input : (null as never);

  it("matches exactly one candidate and refuses to guess", () => {
    expect(
      pickMatch(input, [item({}), item({ id: "c2", number: "4" })])?.id,
    ).toBe("c1");
    expect(pickMatch(input, [item({}), item({ id: "c2" })])).toBeNull();
    expect(pickMatch(input, [item({ setName: "Obsidian Flames" })])).toBeNull();
  });

  it("matches a slab to its raw card and carries the grade; odd graders stay custom", () => {
    const [psa, ace] = readCsv(
      [
        HEAD,
        "Charizard ex,151,199,en,graded,,psa,9.5,1,",
        "Charizard ex,151,199,en,graded,,ace,10,1,",
      ].join("\n"),
    ).map((r) => (r.ok ? r.input : (null as never)));
    const match = pickMatch(psa, [item({})]);
    expect(match?.id).toBe("c1");
    expect(toImportRow(psa, match)).toMatchObject({
      kind: "catalog",
      input: { catalogItemId: "c1", grader: "PSA", grade: "9.5" },
    });
    expect(pickMatch(ace, [item({})])).toBeNull();
  });

  it("previews matched, custom, error and search-limit rows", async () => {
    const rows = readCsv(
      [
        HEAD,
        "Charizard ex,151,199,en,raw,NM,,,1,",
        "Gold card,,,zh,raw,NM,,,1,5",
        "Mew,,,en,raw,NM,,,1,",
        ",,,,,,,,,1",
      ].join("\n"),
    );
    const search = vi
      .fn()
      .mockResolvedValueOnce([item({})])
      .mockRejectedValueOnce(new SearchError("Search limit reached"));
    const out = await previewRows(rows, search);
    expect(out.map((r) => r.status)).toEqual([
      "matched",
      "custom",
      "custom",
      "error",
    ]);
    expect(out[0].row).toMatchObject({
      kind: "catalog",
      input: { catalogItemId: "c1" },
    });
    expect(out[2].note).toMatch(/limit/);
    // Chinese rows never spend a provider call.
    expect(search).toHaveBeenCalledTimes(2);
  });
});
