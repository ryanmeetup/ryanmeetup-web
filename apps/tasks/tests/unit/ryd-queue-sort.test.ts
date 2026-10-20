import { describe, expect, it } from "vitest";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";
import {
  claimedElsewhere,
  orderRyanPositions,
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

  it("groups by where Ryan falls in the form's name, unknown last", () => {
    const orders = [
      order({ orderId: "none", lastName: "A" }),
      order({ orderId: "absent", lastName: "B" }),
      order({ orderId: "middle", lastName: "C" }),
      order({ orderId: "first", lastName: "D" }),
      order({ orderId: "last", lastName: "E" }),
    ];
    const positions = new Map([
      ["none", null],
      ["absent", "absent" as const],
      ["middle", "middle" as const],
      ["first", "first" as const],
      ["last", "last" as const],
    ]);
    const sorted = (key: "ryan" | "middle-name", descending: boolean) =>
      ids(sortRydOrders(orders, { key, descending }, positions));
    expect(sorted("ryan", false)).toEqual([
      "first",
      "middle",
      "last",
      "absent",
      "none",
    ]);
    expect(sorted("ryan", true)).toEqual([
      "absent",
      "last",
      "middle",
      "first",
      "none",
    ]);
    expect(sorted("middle-name", false)[0]).toBe("middle");
    expect(rydSortParam("middle-name")).toEqual({
      key: "middle-name",
      descending: false,
    });
  });

  it("reads Ryan's position from the linked or suggested submission", () => {
    const submission = (key: string, email: string, legalName: string) => ({
      key,
      submittedAt: "",
      submittedAtIso: "",
      legalName,
      email,
      fileIds: [],
      socialText: "",
      socialLinks: [],
      otherAnswers: [],
    });
    const submissions = [
      submission("k1", "fox@test.dev", "Steven Ryan Fox"),
      submission("k2", "gee@test.dev", "Ryan Gee"),
    ];
    const positions = orderRyanPositions(
      [
        order({ orderId: "linked", linkedKeys: ["k1"] }),
        order({
          orderId: "suggested",
          suggestion: { email: "gee@test.dev", confidence: "strong", reasons: [] },
        }),
        order({ orderId: "nothing" }),
      ],
      submissions,
    );
    expect([...positions]).toEqual([
      ["linked", "middle"],
      ["suggested", "first"],
      ["nothing", null],
    ]);
  });

  it("leaves the queue's own order alone without a sort", () => {
    const orders = [order({ orderId: "b" }), order({ orderId: "a" })];
    expect(sortRydOrders(orders, null)).toBe(orders);
  });
});

describe("claimedElsewhere", () => {
  it("collects submissions linked to every other order", () => {
    const orders = [
      order({ orderId: "a", linkedKeys: ["k1"] }),
      order({ orderId: "b", linkedKeys: ["k2", "k3"] }),
      order({ orderId: "c" }),
    ];
    expect([...claimedElsewhere(orders, "a")]).toEqual(["k2", "k3"]);
    expect([...claimedElsewhere(orders, "c")]).toEqual(["k1", "k2", "k3"]);
  });
});
