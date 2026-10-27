import { describe, expect, it } from "vitest";
import { fileMatchesAccept } from "../src/FileDropField";

const file = (name: string, type = "") => new File(["x"], name, { type });

describe("fileMatchesAccept", () => {
  it("accepts anything when no list is given", () => {
    expect(fileMatchesAccept(file("notes.txt"))).toBe(true);
    expect(fileMatchesAccept(file("notes.txt"), " ")).toBe(true);
  });

  it("matches extensions without regard to case", () => {
    expect(fileMatchesAccept(file("Orders.CSV"), ".csv,text/csv")).toBe(true);
    expect(fileMatchesAccept(file("orders.xlsx"), ".csv,text/csv")).toBe(false);
  });

  it("matches an exact MIME type when the name has no extension", () => {
    expect(fileMatchesAccept(file("export", "text/csv"), ".csv,text/csv")).toBe(
      true,
    );
  });

  it("matches MIME wildcards", () => {
    expect(fileMatchesAccept(file("a.png", "image/png"), "image/*")).toBe(true);
    expect(fileMatchesAccept(file("a.pdf", "application/pdf"), "image/*")).toBe(
      false,
    );
  });
});
