import { describe, expect, it } from "vitest";
import { rydCancellationGroups } from "@/lib/ryd/cancellations";
import {
  rydCancellationRequestEmail,
  rydCancelledBuyerEmail,
} from "@/lib/ryd/emails";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";
import {
  RYD_STATUS_PARAMS,
  followUpOrders,
  rydStatusParam,
} from "@/lib/ryd/queue-view";

const order = (overrides: Partial<RydQueueOrder> = {}): RydQueueOrder => ({
  orderId: "1001",
  salesOrder: "",
  orderedAt: "",
  firstName: "Ryan",
  lastName: "Example",
  email: "ryan@example.test",
  displayEmail: "Ryan@example.test",
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
});

describe("RY-D cancellation emails", () => {
  it("lists every order for fulfillment to cancel and refund", () => {
    const draft = rydCancellationRequestEmail([
      order({ orderId: "9369320", firstName: "Ryan", lastName: "Parks" }),
      order({
        orderId: "9372043",
        firstName: "",
        lastName: "",
        displayEmail: "",
      }),
    ]);
    expect(draft.subject).toBe("RY-D orders to cancel and refund: 2");
    expect(draft.body).toContain(
      "Please cancel and refund these 2 RY-D orders.",
    );
    expect(draft.body).toContain(
      "9369320 · Ryan Parks (Ryan@example.test)\n9372043 · buyer name unavailable",
    );
  });

  it("speaks to one order in the singular", () => {
    const draft = rydCancellationRequestEmail([order()]);
    expect(draft.subject).toBe("RY-D order to cancel and refund: 1");
    expect(draft.body).toContain("couldn't be verified as a Ryan, so it won't");
  });

  it("tells the buyer they were refunded and gives the reason that applies", () => {
    const silent = rydCancelledBuyerEmail({
      firstName: "Ryan",
      hasSubmission: false,
    });
    expect(silent.body).toMatch(/^Hi Ryan,/);
    expect(silent.body).toContain("cancelled your RY-D order and refunded it");
    expect(silent.body).toContain("We never received ry-dentification");
    expect(rydCancelledBuyerEmail({ hasSubmission: true }).body).toContain(
      "couldn't confirm from it that you're a Ryan",
    );
  });
});

describe("RY-D cancellation groups", () => {
  it("splits buyers by what they sent and writes each person once", () => {
    const { groups, unreachable } = rydCancellationGroups([
      order(),
      order({ orderId: "1002", email: "RYAN@example.test" }),
      order({
        orderId: "1003",
        displayEmail: "sent@example.test",
        linkedKeys: ["response"],
      }),
      order({ orderId: "1004", displayEmail: "not an email" }),
    ]);
    expect(unreachable).toBe(1);
    expect(groups.map((group) => [group.label, group.addresses])).toEqual([
      ["Nothing sent", ["Ryan@example.test"]],
      ["Sent something that didn't verify", ["sent@example.test"]],
    ]);
    expect(groups[0].draft.body).toMatch(/^Hi Ryan,/);
  });

  it("drops the greeting name when a draft goes to several buyers", () => {
    const { groups } = rydCancellationGroups([
      order(),
      order({ orderId: "1002", displayEmail: "other@example.test" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].draft.body).toMatch(/^Hi there,/);
  });
});

describe("Cancelled status", () => {
  it("uses a readable param and keeps old Rejected links working", () => {
    expect(RYD_STATUS_PARAMS.cancelled).toBe("rejected");
    expect(rydStatusParam("cancelled")).toBe("cancelled");
    expect(rydStatusParam("rejected")).toBe("cancelled");
  });

  it("leaves cancelled orders out of follow-up", () => {
    expect(
      followUpOrders({
        orders: [
          order({ status: "rejected" }),
          order({ orderId: "2", status: "needs_info" }),
        ],
      }).map((row) => row.orderId),
    ).toEqual(["2"]);
  });
});
