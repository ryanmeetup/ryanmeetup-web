import { describe, expect, it } from "vitest";
import {
  reconcileRydQueue,
  withRydQueueMatches,
} from "@/lib/ryd/queue-reconciliation";
import type { RydQueue, RydQueueOrder } from "@/lib/ryd/queue-types";
import type { RydSubmission } from "@/lib/ryd/matching";

const submission: RydSubmission = {
  key: "response-1",
  email: "ryan@example.com",
  legalName: "Ryan Example",
  submittedAt: "",
  submittedAtIso: "",
  fileIds: [],
  socialText: "",
  socialLinks: [],
  otherAnswers: [],
};
const order: RydQueueOrder = {
  orderId: "1001",
  salesOrder: "",
  orderedAt: "",
  firstName: "Ryan",
  lastName: "Example",
  displayEmail: "ryan@example.com",
  email: "ryan@example.com",
  total: "36",
  status: "pending",
  note: null,
  decidedAt: null,
  decidedBy: null,
  updatedAt: "old",
  lastEmailedAt: null,
  sentToFulfillment: false,
  productionSentAt: null,
  doneAt: null,
  linkedKeys: [],
  suggestion: null,
  card: {
    firstName: "Ryan",
    lastName: "Example",
    location: "Chicago",
    ryanSince: "1999",
  },
  cardSaved: true,
  cardHint: { birthday: "", yearSuggestion: null, nameFrom: "options" },
};
function queue() {
  return withRydQueueMatches({
    orders: [order, { ...order, orderId: "1002" }],
    submissions: [submission],
    dismissed: [],
    contacts: {},
    settings: {
      formId: "old-form",
      fulfillmentEmail: null,
      uploadReminder: { enabled: false, weekday: 2, hour: 12 },
    },
    timeZone: "America/New_York",
    uploadDueSince: null,
    sheet: { status: "ok", accountEmail: "synthetic@example.com" },
    clearedCount: 0,
    lastBatch: null,
    installed: true,
  } as RydQueue);
}

describe("RY-D confirmed queue writes", () => {
  it("keeps the canonical decision, normalized note, revision and accepted evidence together", () => {
    const saved = reconcileRydQueue(queue(), {
      type: "review",
      result: {
        ok: true,
        order: {
          order_id: "1001",
          status: "verified",
          note: "Checked",
          decided_at: "now",
          decided_by: "actor",
          updated_at: "new",
        },
      },
      linkedKeys: [submission.key],
    });
    expect(saved.orders[0]).toMatchObject({
      status: "verified",
      note: "Checked",
      decidedAt: "now",
      decidedBy: "actor",
      updatedAt: "new",
      linkedKeys: [submission.key],
      total: "36",
      suggestion: null,
    });
    expect(saved.orders[1].suggestion).toBeNull();
    expect(queue().orders[0].status).toBe("pending");
  });
  it("takes the saved card from the review result", () => {
    const saved = reconcileRydQueue(queue(), {
      type: "review",
      result: {
        ok: true,
        order: {
          order_id: "1001",
          status: "pending",
          note: null,
          decided_at: null,
          decided_by: null,
          updated_at: "new",
          card_first_name: "Ryan",
          card_last_name: "Pérez",
          card_location: "Cleveland Ohio",
          card_ryan_since: "",
        },
      },
      linkedKeys: [],
    });
    expect(saved.orders[0]).toMatchObject({
      card: {
        firstName: "Ryan",
        lastName: "Pérez",
        location: "Cleveland Ohio",
        ryanSince: "",
      },
      cardSaved: true,
    });
  });
  it("recomputes suggestions on both linking and unlinking without duplicating evidence", () => {
    const change = {
      type: "links" as const,
      orderId: "1001",
      keys: [submission.key],
      linked: true,
    };
    const linked = reconcileRydQueue(
      reconcileRydQueue(queue(), change),
      change,
    );
    expect(linked.orders[0].linkedKeys).toEqual([submission.key]);
    expect(linked.orders.every((o) => o.suggestion === null)).toBe(true);
    const unlinked = reconcileRydQueue(linked, { ...change, linked: false });
    expect(unlinked.orders[0].linkedKeys).toEqual([]);
    expect(unlinked.orders[0].suggestion?.confidence).toBe("strong");
  });
  it("removes and restores an acknowledged response and its matching suggestions idempotently", () => {
    const change = { type: "dismissal", submission, dismissed: true } as const;
    const removed = reconcileRydQueue(
      reconcileRydQueue(queue(), change),
      change,
    );
    expect(removed.submissions).toEqual([]);
    expect(removed.dismissed).toEqual([submission]);
    expect(removed.orders.every((o) => o.suggestion === null)).toBe(true);
    const restore = { ...change, dismissed: false };
    const restored = reconcileRydQueue(
      reconcileRydQueue(removed, restore),
      restore,
    );
    expect(restored.submissions).toEqual([submission]);
    expect(restored.dismissed).toEqual([]);
    expect(restored.orders[0].suggestion?.confidence).toBe("strong");
  });
  it("retains evidence for an email-only settings change and clears it for a different form", () => {
    const original = queue();
    const settings = {
      ...original.settings,
      fulfillmentEmail: "new@example.com",
    };
    const sameForm = reconcileRydQueue(original, {
      type: "settings",
      settings,
    });
    expect(sameForm.settings).toEqual(settings);
    expect(sameForm.submissions).toBe(original.submissions);
    const newForm = reconcileRydQueue(sameForm, {
      type: "settings",
      settings: { ...settings, formId: "new-form" },
    });
    expect(newForm.submissions).toEqual([]);
    expect(newForm.dismissed).toEqual([]);
    expect(newForm.orders.every((o) => o.suggestion === null)).toBe(true);
  });
  it("clears old form evidence immediately on a confirmed disconnect", () => {
    const disconnected = reconcileRydQueue(queue(), { type: "disconnect" });
    expect(disconnected.sheet).toEqual({ status: "disconnected" });
    expect(disconnected.submissions).toEqual([]);
    expect(disconnected.dismissed).toEqual([]);
    expect(disconnected.orders[0].suggestion).toBeNull();
  });
  it("preserves claims belonging to finished orders outside the active queue", () => {
    const current = withRydQueueMatches({
      ...queue(),
      submissionClaims: { [submission.key]: "finished-order" },
    });
    expect(current.orders.every((o) => o.suggestion === null)).toBe(true);
    const saved = reconcileRydQueue(current, {
      type: "settings",
      settings: { ...current.settings, fulfillmentEmail: "new@example.com" },
    });
    expect(saved.submissionClaims).toEqual({
      [submission.key]: "finished-order",
    });
    const unlinked = reconcileRydQueue(saved, {
      type: "links",
      orderId: "1001",
      keys: [submission.key],
      linked: false,
    });
    expect(unlinked.orders.every((o) => o.suggestion === null)).toBe(true);
  });
});
