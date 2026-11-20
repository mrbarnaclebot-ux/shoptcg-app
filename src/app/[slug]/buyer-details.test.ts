import { describe, expect, it } from "vitest";
import { mergeDetails, parseDetails } from "./buyer-details";
import { metaLine } from "./tile";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("buyer details", () => {
  it("keeps only known string fields", () => {
    expect(parseDetails('{"name":"Ana","phone":7,"x":"y"}')).toEqual({
      name: "Ana",
    });
    expect(parseDetails("not json")).toEqual({});
    expect(parseDetails("null")).toEqual({});
    expect(parseDetails(null)).toEqual({});
  });

  it("lays a send over what was kept; a blank keeps the old value", () => {
    const had = {
      name: "Ana",
      phone: "+94 77 123 4567",
      address: "12 Galle Rd",
    };
    expect(
      mergeDetails(
        had,
        form({
          name: " Ana Reyes ",
          email: "ana@x.test",
          phone: "",
          promo: "on",
        }),
      ),
    ).toEqual({
      name: "Ana Reyes",
      email: "ana@x.test",
      phone: "+94 77 123 4567",
      address: "12 Galle Rd",
    });
  });
});

describe("metaLine", () => {
  const base = { condition: null, grader: null, grade: null };
  it("leads a slab with its grade, then the card", () => {
    expect(
      metaLine({
        ...base,
        kind: "graded",
        setName: "Evolving Skies",
        number: "215",
        grader: "PSA",
        grade: "10",
      }),
    ).toBe("PSA 10 · Evolving Skies 215");
    expect(
      metaLine({ ...base, kind: "graded", setName: null, number: null }),
    ).toBe("Graded");
    expect(
      metaLine({
        ...base,
        kind: "raw",
        setName: "Base Set",
        number: "4/102",
        condition: "NM",
      }),
    ).toBe("Base Set 4/102. NM");
    expect(
      metaLine({ ...base, kind: "sealed", setName: "151", number: null }),
    ).toBe("Sealed");
  });
});
