import { describe, expect, it } from "vitest";
import {
  readyForRydFulfillment,
  rydFulfillmentCounts,
  rydFulfillmentParam,
  rydFulfillmentStage,
} from "@/lib/ryd/fulfillment-view";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";

const order = (overrides: Partial<RydQueueOrder> = {}) =>
  ({
    orderId: "ready",
    status: "verified",
    sentToFulfillment: false,
    productionSentAt: null,
    doneAt: null,
    ...overrides,
  }) as RydQueueOrder;
const orders = [
  order(),
  order({ orderId: "emailed", sentToFulfillment: true }),
  order({ orderId: "started", productionSentAt: "2026-10-20T12:00:00Z" }),
  order({
    orderId: "done",
    productionSentAt: "2026-10-20T12:00:00Z",
    doneAt: "2026-10-21T12:00:00Z",
  }),
  order({ orderId: "pending", status: "pending" }),
];

describe("RY-D fulfillment handoff", () => {
  it("keeps the email handoff separate from production and preserves legacy production records", () => {
    expect(orders.map(rydFulfillmentStage)).toEqual([
      "ready-to-send",
      "sent-to-fulfillment",
      "in-production",
      "done",
      "ready-to-send",
    ]);
    expect(rydFulfillmentCounts(orders)).toEqual({
      "ready-to-send": 1,
      "sent-to-fulfillment": 1,
      "in-production": 1,
      done: 1,
    });
    expect(readyForRydFulfillment(orders).map((o) => o.orderId)).toEqual([
      "ready",
    ]);
  });

  it("defaults to ready orders and accepts old bookmarks", () => {
    expect(rydFulfillmentParam("")).toBe("ready-to-send");
    expect(rydFulfillmentParam("not-started")).toBe("ready-to-send");
    expect(rydFulfillmentParam("sent-to-fulfillment")).toBe(
      "sent-to-fulfillment",
    );
    expect(rydFulfillmentParam("all")).toBeNull();
    expect(rydFulfillmentParam("unknown")).toBeNull();
  });
});
