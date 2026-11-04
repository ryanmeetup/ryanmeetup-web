import { describe, expect, it } from "vitest";
import { rydCardFilter, rydCardGaps } from "@/lib/ryd/queue-view";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";

const card = {
  firstName: "Ryan",
  lastName: "Le",
  location: "Brooklyn, NY",
  ryanSince: "1999",
};
const order = (overrides: Partial<RydQueueOrder> = {}) =>
  ({ status: "verified", card, ...overrides }) as RydQueueOrder;

describe("RY-D card filter", () => {
  it("reads only the readable value, defaulting to every order", () => {
    expect(rydCardFilter("unfinished")).toBe("unfinished");
    expect(rydCardFilter("")).toBe("all");
    expect(rydCardFilter("nonsense")).toBe("all");
  });

  it("names the lines an open card still needs", () => {
    expect(rydCardGaps(order())).toEqual([]);
    expect(
      rydCardGaps(order({ card: { ...card, location: "", ryanSince: "" } })),
    ).toEqual(["Location", "Ryan since"]);
  });

  it("never flags a cancelled order, which doesn't print", () => {
    expect(
      rydCardGaps(
        order({ status: "rejected", card: { ...card, location: "" } }),
      ),
    ).toEqual([]);
  });
});
