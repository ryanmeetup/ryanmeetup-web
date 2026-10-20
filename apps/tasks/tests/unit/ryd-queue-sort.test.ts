import { describe, expect, it } from "vitest";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";
import {
  nextRydSort,
  rydSortParam,
  rydSortValue,
  sortRydOrders,
} from "@/lib/ryd/queue-view";

function order(overrides: Partial<RydQueueOrder>): RydQueueOrder {
  return {
    orderId: "1",
    salesOrder: "",
    orderedAt: "",
    firstName: "Ryan",
    lastName: "",
    displayEmail: "",
    email: "",
    contactMethod: "",
    total: "",
    status: "pending",
    note: null,
    decidedAt: null,
    decidedBy: null,
    lastEmailedAt: null,
    linkedKeys: [],
    suggestion: null,
    ...overrides,
  };
}

const ids = (orders: RydQueueOrder[]) => orders.map((o) => o.orderId);

describe("RY-D queue sorting", () => {
  it("reads and writes readable sort params", () => {
    expect(rydSortParam("name")).toEqual({ key: "name", descending: false });
    expect(rydSortParam("form-desc")).toEqual({
      key: "form",
      descending: true,
    });
    expect(rydSortParam("total")).toBeNull();
    expect(rydSortParam("")).toBeNull();
    expect(rydSortValue({ key: "status", descending: true })).toBe(
      "status-desc",
    );
    expect(rydSortValue(null)).toBe("");
  });

  it("cycles a column ascending, descending, then off", () => {
    const asc = nextRydSort(null, "name");
    expect(asc).toEqual({ key: "name", descending: false });
    const desc = nextRydSort(asc, "name");
    expect(desc).toEqual({ key: "name", descending: true });
    expect(nextRydSort(desc, "name")).toBeNull();
    expect(nextRydSort(desc, "status")).toEqual({
      key: "status",
      descending: false,
    });
  });

  it("sorts by surname, ignoring case and accents", () => {
    const orders = [
      order({ orderId: "a", lastName: "peters" }),
      order({ orderId: "b", lastName: "Ábel" }),
      order({ orderId: "c", lastName: "Mitchell" }),
    ];
    expect(
      ids(sortRydOrders(orders, { key: "name", descending: false })),
    ).toEqual(["b", "c", "a"]);
    expect(
      ids(sortRydOrders(orders, { key: "name", descending: true })),
    ).toEqual(["a", "c", "b"]);
  });

  it("sorts status by workflow and breaks ties by name", () => {
    const orders = [
      order({ orderId: "a", status: "rejected", lastName: "A" }),
      order({ orderId: "b", status: "pending", lastName: "Z" }),
      order({ orderId: "c", status: "needs_info", lastName: "A" }),
      order({ orderId: "d", status: "pending", lastName: "B" }),
    ];
    expect(
      ids(sortRydOrders(orders, { key: "status", descending: false })),
    ).toEqual(["d", "b", "c", "a"]);
  });

  it("puts the surest form pairing first", () => {
    const suggestion = (confidence: "strong" | "possible" | "weak") => ({
      email: "x@test.dev",
      confidence,
      reasons: [],
    });
    const orders = [
      order({ orderId: "none" }),
      order({ orderId: "weak", suggestion: suggestion("weak") }),
      order({ orderId: "linked", linkedKeys: ["k"] }),
      order({ orderId: "strong", suggestion: suggestion("strong") }),
      order({ orderId: "possible", suggestion: suggestion("possible") }),
    ];
    expect(
      ids(sortRydOrders(orders, { key: "form", descending: false })),
    ).toEqual(["linked", "strong", "possible", "weak", "none"]);
  });

  it("sorts by order date, undated last", () => {
    const orders = [
      order({ orderId: "late", orderedAt: "10/14/2026 3:31 PM" }),
      order({ orderId: "undated" }),
      order({ orderId: "early", orderedAt: "10/14/2026 11:26 AM" }),
    ];
    expect(
      ids(sortRydOrders(orders, { key: "ordered", descending: false })),
    ).toEqual(["early", "late", "undated"]);
  });

  it("leaves the queue's own order alone without a sort", () => {
    const orders = [order({ orderId: "b" }), order({ orderId: "a" })];
    expect(sortRydOrders(orders, null)).toBe(orders);
  });
});
