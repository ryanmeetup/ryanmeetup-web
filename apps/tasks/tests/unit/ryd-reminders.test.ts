import { describe, expect, it } from "vitest";
import { rydReminderSchema } from "@/lib/api-schema";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";
import { rydReminderGroups } from "@/lib/ryd/reminders";

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

describe("RY-D reminder drafts", () => {
  it("keeps single-buyer greetings and includes suggested evidence in the request for more", () => {
    const groups = rydReminderGroups([
      order({
        suggestion: {
          email: "ryan@example.test",
          confidence: "strong",
          reasons: [],
        },
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("more:0");
    expect(groups[0].draft.body).toContain("Hi Ryan,");
    expect(groups[0].draft.body).toContain("add a little more");
    expect(groups[0].targets).toEqual([
      { orderId: "1001", email: "ryan@example.test" },
    ]);
  });
  it("groups a shared buyer's orders using all their evidence and one address", () => {
    const groups = rydReminderGroups([
      order(),
      order({ orderId: "1002", linkedKeys: ["response"] }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].addresses).toEqual(["Ryan@example.test"]);
    expect(groups[0].targets).toHaveLength(2);
    expect(groups[0].key).toBe("more:0");
  });
  it("keeps reminder eligibility aligned across entry points", () => {
    expect(
      rydReminderGroups([
        order({ status: "rejected" }),
        order({ orderId: "2", status: "verified" }),
        order({ orderId: "3", sentToFulfillment: true }),
        order({ orderId: "4", displayEmail: "different@example.test" }),
        order({ orderId: "5", email: "", displayEmail: "" }),
      ]),
    ).toEqual([]);
  });
  it("partitions all selected orders into independently confirmable groups within the JSON byte limit", () => {
    const rows = Array.from({ length: 205 }, (_, index) =>
      order({
        orderId: `${"界".repeat(55)}${index}`,
        email: `${index}${"é".repeat(120)}@example.test`,
        displayEmail: `${index}${"é".repeat(120)}@example.test`,
      }),
    );
    const groups = rydReminderGroups(rows);
    expect(groups.length).toBeGreaterThan(3);
    expect(groups.flatMap((group) => group.targets)).toHaveLength(205);
    for (const group of groups) {
      expect(group.targets.length).toBeLessThanOrEqual(100);
      const bytes = new TextEncoder().encode(
        JSON.stringify({
          operationId: "40000000-0000-4000-8000-000000000401",
          targets: group.targets,
        }),
      ).byteLength;
      expect(bytes).toBeLessThanOrEqual(14000);
    }
    expect(new Set(groups.map((group) => group.key)).size).toBe(groups.length);
  });
  it("ignores duplicate selected IDs", () => {
    expect(rydReminderGroups([order(), order()])[0].targets).toHaveLength(1);
  });
  it("rejects an ambiguous confirmation payload", () => {
    const operationId = "40000000-0000-4000-8000-000000000401";
    const target = { orderId: "1001", email: "ryan@example.test" };
    expect(
      rydReminderSchema({ operationId, targets: [target, target] }),
    ).toBeNull();
    expect(
      rydReminderSchema({ operationId, targets: [target], orderIds: ["1002"] }),
    ).toBeNull();
    expect(rydReminderSchema({ orderIds: ["1001"] })).toBeNull();
    expect(rydReminderSchema({ operationId, targets: [target] })).toEqual({
      operationId,
      targets: [target],
    });
  });
});
