import { describe, expect, it } from "vitest";
import {
  initialProximityScrollTop,
  orderProximityOptions,
} from "../src/useProximityOptions";

const options = [
  { label: "Alex", value: "alex" },
  { label: "Ryan", value: "self" },
  { label: "Taylor", value: "taylor" },
];

describe("orderProximityOptions", () => {
  it("puts the proximity value first when the menu opens downward", () => {
    expect(
      orderProximityOptions(options, false, "self").map(
        (option) => option.value,
      ),
    ).toEqual(["self", "alex", "taylor"]);
  });

  it("puts the proximity value last when the menu opens upward", () => {
    expect(
      orderProximityOptions(options, true, "self").map(
        (option) => option.value,
      ),
    ).toEqual(["alex", "taylor", "self"]);
  });

  it("starts an upward-opening menu at the options nearest its trigger", () => {
    expect(initialProximityScrollTop(true, true, 640)).toBe(640);
  });

  it("starts other menus at the top", () => {
    expect(initialProximityScrollTop(false, true, 640)).toBe(0);
    expect(initialProximityScrollTop(true, false, 640)).toBe(0);
  });
});
