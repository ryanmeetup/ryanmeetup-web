import { describe, expect, it } from "vitest";
import {
  rydEmailsSchema,
  rydLinkCreateSchema,
  rydProductionSchema,
} from "@/lib/api-schema/ryd";
import {
  RYD_BULK_BODY_BYTES,
  RYD_BULK_LIMIT,
  RYD_MAILTO_LIMIT,
  rydBodyBytes,
  rydContactGroups,
  rydProductionGroups,
} from "@/lib/ryd/bulk-operations";
import { rydMailtoHref, rydUnmatchedEmail } from "@/lib/ryd/emails";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";

const operationId = "00000000-0000-4000-8000-000000000601";
const order = (id: string, stage = "not-started") =>
  ({
    orderId: id,
    status: "verified",
    productionSentAt: stage === "not-started" ? null : "2026-10-20T12:00:00Z",
    doneAt: stage === "done" ? "2026-10-21T12:00:00Z" : null,
  }) as RydQueueOrder;

describe("RY-D bounded operation contracts", () => {
  it("pins mixed backward moves in one atomic group", () => {
    expect(
      rydProductionGroups(
        [order("1", "done"), order("2", "in-production"), order("3")],
        "back",
      ),
    ).toEqual([
      [
        { orderId: "1", from: "done", to: "in-production" },
        { orderId: "2", from: "in-production", to: "not-started" },
      ],
    ]);
  });
  it.each(["sent", "done", "back"] as const)(
    "bounds a large %s selection by count and encoded bytes",
    (action) => {
      const orders = Array.from({ length: 603 }, (_, i) =>
        order(
          `${i}${"界".repeat(60)}`,
          action === "back" ? "done" : "not-started",
        ),
      );
      const groups = rydProductionGroups(orders, action);
      expect(groups.flat()).toHaveLength(603);
      for (const moves of groups) {
        const request = { operationId, moves };
        expect(moves.length).toBeLessThanOrEqual(RYD_BULK_LIMIT);
        expect(rydBodyBytes(request)).toBeLessThanOrEqual(RYD_BULK_BODY_BYTES);
        expect(rydProductionSchema(request)).toEqual(request);
      }
    },
  );
  it("never moves a done order forward or includes an unverified order", () => {
    expect(
      rydProductionGroups(
        [
          order("1", "done"),
          order("2", "in-production"),
          order("3"),
          { ...order("4"), status: "pending" },
        ],
        "sent",
      ),
    ).toEqual([[{ orderId: "3", from: "not-started", to: "in-production" }]]);
  });
  it.each([true, false])(
    "bounds long contact addresses with draft=%s",
    (draft) => {
      const emails = Array.from(
        { length: 603 },
        (_, i) => `${i}${"a".repeat(300)}@example.test`,
      );
      const groups = rydContactGroups(
        [...emails, emails[0].toUpperCase(), "broken"],
        draft,
      );
      expect(groups.flat()).toEqual(emails);
      for (const group of groups) {
        const body = { operationId, emails: group };
        expect(group.length).toBeLessThanOrEqual(RYD_BULK_LIMIT);
        expect(rydBodyBytes(body)).toBeLessThanOrEqual(RYD_BULK_BODY_BYTES);
        expect(rydEmailsSchema(body)).toEqual(body);
        if (draft)
          expect(
            rydMailtoHref({ bcc: group, ...rydUnmatchedEmail() }).length,
          ).toBeLessThanOrEqual(RYD_MAILTO_LIMIT);
      }
    },
  );
  it("keeps a single oversized mail link available for copying", () => {
    const email = `${"é".repeat(290)}@example.test`;
    expect(rydContactGroups([email])).toEqual([[email]]);
    expect(
      rydMailtoHref({ bcc: [email], ...rydUnmatchedEmail() }).length,
    ).toBeGreaterThan(RYD_MAILTO_LIMIT);
  });
  it("rejects oversized or ambiguous production requests before dispatch", () => {
    const move = { orderId: "1", from: "not-started", to: "done" };
    for (const body of [
      { moves: [move] },
      { operationId, moves: [] },
      { operationId, moves: [move, move] },
      { operationId, moves: [{ ...move, from: "done" }] },
      { operationId, moves: [{ ...move, to: "shipped" }] },
      { operationId, moves: [move], extra: true },
      { operationId, moves: [{ ...move, extra: true }] },
      {
        operationId,
        moves: Array.from({ length: 101 }, (_, i) => ({
          ...move,
          orderId: String(i),
        })),
      },
    ])
      expect(rydProductionSchema(body)).toBeNull();
  });
  it("requires a contact operation key and enforces the body budget", () => {
    expect(rydEmailsSchema({ emails: ["a@example.test"] })).toBeNull();
    expect(rydEmailsSchema({ operationId, emails: [] })).toBeNull();
    expect(
      rydEmailsSchema({ operationId, emails: ["a@example.test"], extra: true }),
    ).toBeNull();
    expect(
      rydEmailsSchema({
        operationId,
        emails: Array.from(
          { length: 90 },
          (_, i) => `${i}${"a".repeat(300)}@example.test`,
        ),
      }),
    ).toBeNull();
  });
  it("accepts legacy single links and one bounded multi-response link", () => {
    expect(
      rydLinkCreateSchema({ submissionKey: "one", source: "manual" }),
    ).toEqual({ submissionKeys: ["one"], source: "manual" });
    expect(
      rydLinkCreateSchema({
        submissionKeys: ["one", "two", "one"],
        source: "manual",
      }),
    ).toEqual({ submissionKeys: ["one", "two"], source: "manual" });
    expect(
      rydLinkCreateSchema({
        submissionKeys: Array.from({ length: 101 }, (_, i) => `key${i}`),
        source: "manual",
      }),
    ).toBeNull();
    expect(
      rydLinkCreateSchema({
        submissionKeys: Array.from(
          { length: 99 },
          (_, i) => `${i}${"x".repeat(390)}`,
        ),
        source: "manual",
      }),
    ).toBeNull();
  });
});
