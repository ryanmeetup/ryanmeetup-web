import { describe, expect, it, vi } from "vitest";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";
import type { RydSubmission } from "@/lib/ryd/matching";
import { decideRydOrder } from "@/lib/ryd/ryd-decisions";

const mutate = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));
vi.mock("@/lib/mutation-client", () => ({ mutate }));

describe("RY-D decisions", () => {
  it("accepts the complete suggested evidence and status in a single request", async () => {
    const order: RydQueueOrder = {
      orderId: "123",
      salesOrder: "", orderedAt: "", firstName: "Ryan", lastName: "Example",
      email: "ryan@example.com", displayEmail: "ryan@example.com", total: "",
      status: "pending",
      note: null, decidedAt: null, decidedBy: null, lastEmailedAt: null,
      sentToFulfillment: false, productionSentAt: null, doneAt: null,
      updatedAt: "2026-10-20T12:00:00Z",
      linkedKeys: [],
      suggestion: { email: "ryan@example.com", confidence: "strong", reasons: [] },
    };
    const submissions = [
      { key: "first-response", email: "ryan@example.com" },
      { key: "second-response", email: "ryan@example.com" },
    ] as RydSubmission[];
    await decideRydOrder(order, submissions, "verified", "Checked");
    expect(mutate).toHaveBeenCalledExactlyOnceWith("/api/ryd/orders/123", {
      method: "PATCH",
      body: JSON.stringify({
        status: "verified",
        note: "Checked",
        expectedStatus: "pending",
        expectedUpdatedAt: order.updatedAt,
        submissionKeys: ["first-response", "second-response"],
      }),
    });
  });
});
