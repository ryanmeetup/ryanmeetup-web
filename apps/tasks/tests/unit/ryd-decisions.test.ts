import { describe, expect, it, vi } from "vitest";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";
import type { RydSubmission } from "@/lib/ryd/matching";
import {
  changeRydLinks,
  decideRydOrder,
  decideRydOrders,
  saveRydNote,
} from "@/lib/ryd/ryd-decisions";

const mutate = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));
vi.mock("@/lib/mutation-client", () => ({ mutate }));

const reviewOrder: RydQueueOrder = {
  orderId: "123",
  salesOrder: "",
  orderedAt: "",
  firstName: "Ryan",
  lastName: "Example",
  email: "ryan@example.com",
  displayEmail: "ryan@example.com",
  total: "",
  status: "pending",
  note: null,
  decidedAt: null,
  decidedBy: null,
  lastEmailedAt: null,
  sentToFulfillment: false,
  productionSentAt: null,
  productionStartedAt: null,
  doneAt: null,
  updatedAt: "2026-10-20T12:00:00Z",
  linkedKeys: [],
  suggestion: {
    email: "ryan@example.com",
    confidence: "strong",
    reasons: [],
  },

  card: {
    firstName: "Ryan",
    lastName: "Example",
    location: "Chicago",
    ryanSince: "1999",
  },
  cardSaved: true,
  cardHint: { birthday: "", yearSuggestion: null, nameFrom: "options" },
};

describe("RY-D decisions", () => {
  it("accepts the complete suggested evidence and status in a single request", async () => {
    const order = reviewOrder;
    const submissions = [
      { key: "first-response", email: "ryan@example.com" },
      { key: "second-response", email: "ryan@example.com" },
    ] as RydSubmission[];
    const result = {
      ok: true,
      order: {
        order_id: "123",
        status: "verified",
        note: "Checked",
        updated_at: "new",
      },
    };
    mutate.mockResolvedValueOnce(result);
    await expect(
      decideRydOrder(order, submissions, "verified", "Checked"),
    ).resolves.toEqual({
      type: "review",
      result,
      linkedKeys: ["first-response", "second-response"],
    });
    expect(mutate).toHaveBeenCalledExactlyOnceWith("/api/ryd/orders/123", {
      method: "PATCH",
      body: JSON.stringify({
        status: "verified",
        note: "Checked",
        expectedStatus: "pending",
        expectedUpdatedAt: order.updatedAt,
        // Verifying approves the card as shown.
        card: order.card,
        submissionKeys: ["first-response", "second-response"],
      }),
    });
  });
  it("returns the saved note and revision without re-reading the queue", async () => {
    const result = {
      ok: true,
      order: {
        order_id: "1001",
        status: "verified",
        note: "Checked",
        updated_at: "new",
      },
    };
    mutate.mockClear().mockResolvedValueOnce(result);
    await expect(
      saveRydNote(
        { orderId: "1001", updatedAt: "old" } as RydQueueOrder,
        "  Checked  ",
      ),
    ).resolves.toEqual({ type: "review", result, linkedKeys: [] });
    expect(mutate).toHaveBeenCalledExactlyOnceWith("/api/ryd/orders/1001", {
      method: "PATCH",
      body: JSON.stringify({ note: "  Checked  ", expectedUpdatedAt: "old" }),
    });
  });
  it("returns only acknowledged link changes and propagates a refused write", async () => {
    mutate.mockClear().mockResolvedValueOnce({ ok: true, changed: false });
    await expect(
      changeRydLinks("1001", ["response-1"], false),
    ).resolves.toEqual({
      type: "links",
      orderId: "1001",
      keys: ["response-1"],
      linked: false,
    });
    expect(mutate).toHaveBeenCalledExactlyOnceWith(
      "/api/ryd/orders/1001/links",
      {
        method: "DELETE",
        body: JSON.stringify({ submissionKey: "response-1" }),
      },
    );
    mutate.mockRejectedValueOnce(new Error("Already claimed"));
    await expect(changeRydLinks("1001", ["response-1"], true)).rejects.toThrow(
      "Already claimed",
    );
  });
});

describe("RY-D bulk decisions", () => {
  it("sends 77 suggested orders in one request and returns individual refusals", async () => {
    const orders = Array.from({ length: 77 }, (_, i) => ({
      ...reviewOrder, orderId: String(i), email: `ryan${i}@example.test`,
      suggestion: { email: `ryan${i}@example.test`, confidence: "strong" as const, reasons: [] },
    }));
    const submissions = orders.map((order) => ({ key: `response-${order.orderId}`, email: order.email })) as RydSubmission[];
    const saved = { reviews: [{ result: { ok: true, order: { order_id: "0" } }, linkedKeys: ["response-0"] }],
      failures: [{ orderId: "1", message: "This order changed." }] };
    mutate.mockReset().mockResolvedValue(saved);
    await expect(decideRydOrders(orders, submissions, "verified")).resolves.toEqual(saved);
    expect(mutate).toHaveBeenCalledTimes(1);
    const [url, request] = mutate.mock.calls[0];
    expect(url).toBe("/api/ryd/decisions");
    const { decisions } = JSON.parse(request.body);
    expect(decisions).toHaveLength(77);
    expect(decisions[0]).toEqual({ orderId: "0", status: "verified", expectedStatus: "pending",
      expectedUpdatedAt: reviewOrder.updatedAt, card: reviewOrder.card, submissionKeys: ["response-0"] });
  });

  it("retains a failed group while accepting the following group's canonical changes", async () => {
    const orders = Array.from({ length: 101 }, (_, i) => ({ ...reviewOrder, orderId: String(i) }));
    const saved = { reviews: [{ result: { ok: true, order: { order_id: "100" } }, linkedKeys: [] }], failures: [] };
    mutate.mockReset().mockRejectedValueOnce(new Error("Synthetic lost connection")).mockResolvedValueOnce(saved);
    const result = await decideRydOrders(orders, [], "needs_info");
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(result.reviews).toEqual(saved.reviews);
    expect(result.failures).toHaveLength(100);
    expect(result.failures[0]).toEqual({ orderId: "0", message: "Synthetic lost connection" });
    expect(result.failures.at(-1)?.orderId).toBe("99");
    for (const [, request] of mutate.mock.calls)
      expect(JSON.parse(request.body).decisions.every((decision: Record<string, unknown>) => !("card" in decision) && !("submissionKeys" in decision))).toBe(true);
  });
});
