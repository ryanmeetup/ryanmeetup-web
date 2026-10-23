import { describe, expect, it } from "vitest";
import { rydProductionSchema } from "@/lib/api-schema/ryd";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";
import {
  claimedElsewhere,
  canEmailRydOrder,
  contactableSubmitters,
  linkableOrders,
  orderRyanPositions,
  rydProductionCounts,
  rydProductionParam,
  rydProductionStage,
  unsentOrders,
  rydSortParam,
  rydSortValue,
  rydStatusParam,
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
    total: "",
    status: "pending",
    note: null,
    decidedAt: null,
    decidedBy: null,
    lastEmailedAt: null,
    sentToFulfillment: false,
    productionSentAt: null,
    doneAt: null,
    linkedKeys: [],
    suggestion: null,
    ...overrides,
  };
}

const ids = (orders: RydQueueOrder[]) => orders.map((o) => o.orderId);

describe("RY-D queue sorting", () => {
  it("rejects inherited object properties as status query values", () => {
    for (const param of ["constructor", "toString", "__proto__"])
      expect(rydStatusParam(param)).toBe("pending");
  });

  it("only emails waiting orders with a usable address", () => {
    expect(canEmailRydOrder(order({ email: "ryan@example.com" }))).toBe(true);
    expect(
      canEmailRydOrder(
        order({ status: "rejected", email: "ryan@example.com" }),
      ),
    ).toBe(false);
    expect(
      canEmailRydOrder(
        order({ status: "verified", email: "ryan@example.com" }),
      ),
    ).toBe(false);
    expect(canEmailRydOrder(order({ email: "" }))).toBe(false);
  });
  it("reads and writes readable sort params", () => {
    expect(rydSortParam("name")).toEqual({ key: "name", descending: false });
    expect(rydSortParam("form-desc")).toEqual({
      key: "form",
      descending: true,
    });
    expect(rydSortParam("production")).toEqual({
      key: "production",
      descending: false,
    });
    expect(rydSortParam("production-sent-desc")).toEqual({
      key: "production-sent",
      descending: true,
    });
    expect(rydSortValue({ key: "production-sent", descending: true })).toBe(
      "production-sent-desc",
    );
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
    expect(
      ids(sortRydOrders(orders, { key: "ordered", descending: true })),
    ).toEqual(["late", "early", "undated"]);
  });

  it("sorts production stages in workflow order with names breaking ties", () => {
    const sent = "2026-10-20T12:00:00Z";
    const orders = [
      order({ orderId: "done", productionSentAt: sent, doneAt: sent }),
      order({ orderId: "waiting-z", lastName: "Z" }),
      order({ orderId: "sent", productionSentAt: sent }),
      order({ orderId: "waiting-a", lastName: "A" }),
    ];
    expect(
      ids(sortRydOrders(orders, { key: "production", descending: false })),
    ).toEqual(["waiting-a", "waiting-z", "sent", "done"]);
    expect(
      ids(sortRydOrders(orders, { key: "production", descending: true })),
    ).toEqual(["done", "sent", "waiting-a", "waiting-z"]);
    expect(ids(orders)).toEqual(["done", "waiting-z", "sent", "waiting-a"]);
  });

  it("sorts sent dates chronologically, keeping missing dates last in either direction", () => {
    const orders = [
      order({ orderId: "waiting", lastName: "A" }),
      order({ orderId: "late", productionSentAt: "2026-10-21T12:00:00Z" }),
      order({
        orderId: "early-z",
        lastName: "Z",
        productionSentAt: "2026-10-20T08:00:00-04:00",
      }),
      order({ orderId: "invalid", lastName: "B", productionSentAt: "invalid" }),
      order({
        orderId: "early-a",
        lastName: "A",
        productionSentAt: "2026-10-20T12:00:00Z",
        doneAt: "2026-10-23T12:00:00Z",
      }),
    ];
    expect(
      ids(sortRydOrders(orders, { key: "production-sent", descending: false })),
    ).toEqual(["early-a", "early-z", "late", "waiting", "invalid"]);
    expect(
      ids(sortRydOrders(orders, { key: "production-sent", descending: true })),
    ).toEqual(["late", "early-a", "early-z", "waiting", "invalid"]);
  });

  it("groups by where Ryan falls in the form's name, unknown last", () => {
    const orders = [
      order({ orderId: "none", firstName: "", lastName: "" }),
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

  it("reads Ryan's position from the submission, else the buyer's name", () => {
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
          suggestion: {
            email: "gee@test.dev",
            confidence: "strong",
            reasons: [],
          },
        }),
        order({ orderId: "buyer-ryan", firstName: "Ryan", lastName: "Burch" }),
        order({
          orderId: "buyer-other",
          firstName: "Brooke",
          lastName: "Ericson",
        }),
        order({ orderId: "nameless", firstName: "", lastName: "" }),
      ],
      submissions,
    );
    expect([...positions]).toEqual([
      ["linked", "middle"],
      ["suggested", "first"],
      ["buyer-ryan", "first"],
      ["buyer-other", "absent"],
      ["nameless", null],
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

describe("linkableOrders", () => {
  it("drops linked orders and groups the rest by status, then name", () => {
    const orders = [
      order({ orderId: "a", lastName: "Zed", status: "needs_info" }),
      order({ orderId: "b", lastName: "Bell", linkedKeys: ["k1"] }),
      order({ orderId: "c", lastName: "Young" }),
      order({ orderId: "d", lastName: "Abel", status: "needs_info" }),
      order({ orderId: "e", lastName: "Finn" }),
    ];
    expect(ids(linkableOrders(orders))).toEqual(["e", "c", "d", "a"]);
  });

  it("leaves out submitters contacted within the last day", () => {
    const now = Date.parse("2026-10-20T12:00:00Z");
    const submitters = ["fresh", "stale", "never"].map((name) => ({
      key: `email:${name}@example.com`,
      email: `${name}@example.com`,
      submissions: [],
    }));
    const contacts = {
      "fresh@example.com": {
        attempts: 1,
        lastContactedAt: "2026-10-20T08:00:00Z",
      },
      "stale@example.com": {
        attempts: 3,
        lastContactedAt: "2026-10-19T08:00:00Z",
      },
    };

    expect(
      contactableSubmitters(submitters, contacts, now).map((s) => s.email),
    ).toEqual(["stale@example.com", "never@example.com"]);
  });
});

describe("RY-D production", () => {
  const sent = "2026-10-18T15:00:00Z";
  const done = "2026-10-19T15:00:00Z";

  it("reads the stage from the two dates, done winning", () => {
    expect(rydProductionStage(order({}))).toBe("not-started");
    expect(rydProductionStage(order({ productionSentAt: sent }))).toBe(
      "in-production",
    );
    expect(
      rydProductionStage(order({ productionSentAt: sent, doneAt: done })),
    ).toBe("done");
  });

  it("counts only verified orders", () => {
    expect(
      rydProductionCounts([
        order({ orderId: "1", status: "verified" }),
        order({ orderId: "2", status: "verified", productionSentAt: sent }),
        order({
          orderId: "3",
          status: "verified",
          productionSentAt: sent,
          doneAt: done,
        }),
        order({ orderId: "4", status: "pending" }),
      ]),
    ).toEqual({ "not-started": 1, "in-production": 1, done: 1 });
  });

  it("keeps cleared orders out of the next fulfillment file", () => {
    expect(
      ids(
        unsentOrders([
          order({ orderId: "1" }),
          order({ orderId: "2", sentToFulfillment: true }),
        ]),
      ),
    ).toEqual(["1"]);
  });

  it("reads readable production params", () => {
    expect(rydProductionParam("in-production")).toBe("in-production");
    expect(rydProductionParam("in_production")).toBeNull();
    expect(rydProductionParam("")).toBeNull();
  });

  it("accepts a pinned production operation", () => {
    const request = {
      operationId: "00000000-0000-4000-8000-000000000601",
      moves: [{ orderId: "1", from: "not-started", to: "done" }],
    };
    expect(rydProductionSchema(request)).toEqual(request);
    expect(rydProductionSchema({ orderIds: ["1"], stage: "done" })).toBeNull();
  });
});
