import { describe, expect, it } from "vitest";
import { csvField, csvLine } from "@/lib/csv";

describe("csvField", () => {
  it("passes plain values through", () => {
    expect(csvField("Ana")).toBe("Ana");
    expect(csvField(42)).toBe("42");
  });

  it("quotes fields with commas and newlines", () => {
    expect(csvField("General × 2, Platea A1")).toBe('"General × 2, Platea A1"');
    expect(csvField("línea1\nlínea2")).toBe('"línea1\nlínea2"');
  });

  it("escapes embedded quotes", () => {
    expect(csvField('El "Show"')).toBe('"El ""Show"""');
  });
});

describe("csvLine", () => {
  it("joins fields with commas", () => {
    expect(csvLine(["a", "b,c", 1])).toBe('a,"b,c",1');
  });
});
