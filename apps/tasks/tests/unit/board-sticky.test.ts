import { describe, expect, it } from "vitest";
import { boardStickyOffset } from "@/lib/tasks/board-sticky";

const column = {
  columnTop: 200,
  columnHeight: 2000,
  headerTop: 12,
  headerHeight: 32,
  pinTop: 64,
};

describe("board sticky headings", () => {
  it("leaves the heading alone while the column is below the app header", () => {
    expect(boardStickyOffset(column)).toBe(0);
  });

  it("slides the heading down by whatever the page has scrolled past", () => {
    expect(boardStickyOffset({ ...column, columnTop: -100 })).toBe(152);
  });

  it("stops the heading at the bottom of a short column", () => {
    expect(
      boardStickyOffset({ ...column, columnTop: -5000, columnHeight: 100 }),
    ).toBe(44);
  });

  it("rests the heading an inset below the app header", () => {
    expect(boardStickyOffset({ ...column, columnTop: -100, gap: 32 })).toBe(
      184,
    );
  });

  it("never moves a heading that fills its whole column", () => {
    expect(
      boardStickyOffset({ ...column, columnTop: -5000, columnHeight: 56 }),
    ).toBe(0);
  });
});
