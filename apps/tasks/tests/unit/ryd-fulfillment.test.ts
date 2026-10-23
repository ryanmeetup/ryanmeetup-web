import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rydBatchSchema } from "@/lib/api-schema";
import { parseCsv } from "@/lib/ryd/csv";
import {
  finishRydFulfillment,
  prepareRydFulfillment,
  rydFulfillmentCsv,
} from "@/lib/server/ryd-fulfillment";

const google = vi.hoisted(() => ({
  load: vi.fn(),
  read: vi.fn(),
  tick: vi.fn(),
}));
vi.mock("@/lib/server/ryd-google", () => ({
  loadRydGoogleIntegration: google.load,
  readRydSubmissions: google.read,
  markRydSubmissionsVerified: google.tick,
}));

const snapshot = {
  id: "00000000-0000-4000-8000-000000000301",
  state: "prepared",
  recipient: "fulfillment@example.test",
  headers: ["OrderId", "Verified?"],
  prepared_at: "2026-10-20T12:00:00Z",
  form_id: "original-form",
  response_keys: ["original-response"],
  verified_ids: ["1"],
  order_rows: [
    {
      order_id: "1",
      status: "verified",
      raw: { OrderId: "1" },
      first_name: "Ryan",
      last_name: "One",
    },
    {
      order_id: "2",
      status: "pending",
      raw: { OrderId: "2" },
      first_name: "Ryan",
      last_name: "Two",
    },
  ],
};

function client(result: unknown, request?: (url: URL) => void) {
  return createClient("http://ryd.test", "synthetic-test-key", {
    global: {
      fetch: async (input) => {
        request?.(new URL(String(input)));
        return Response.json(result);
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  google.load.mockResolvedValue({ account_email: "form@example.test" });
  google.read.mockResolvedValue({
    linkedSheetId: "original-sheet",
    questionTitles: ["Your email"],
    submissions: [{ key: "original-response" }, { key: "later-response" }],
  });
  google.tick.mockResolvedValue({
    responses: [{ key: "original-response", outcome: "updated" }],
  });
});

describe("RY-D immutable fulfillment manifests", () => {
  it("builds its draft from the manifest's ready rows", async () => {
    const draft = await prepareRydFulfillment(client(snapshot), "actor");
    expect(draft).toMatchObject({
      id: snapshot.id,
      recipient: snapshot.recipient,
      orderCount: 2,
      verifiedCount: 1,
      requiresRebuild: false,
    });
    expect(draft.draft.body).toContain("1 · Ryan One");
    expect(draft.draft.body).toContain(`Batch: ${snapshot.id}`);
    expect(draft.draft.body).not.toContain("Ryan Two");
  });
  it("flags an older prepared manifest without silently replacing it", async () => {
    const draft = await prepareRydFulfillment(
      client({ ...snapshot, requires_rebuild: true }),
      "actor",
    );
    expect(draft).toMatchObject({ id: snapshot.id, requiresRebuild: true });
  });
  it("refuses downloading a prepared batch containing ineligible orders", async () => {
    const admin = createClient("http://ryd.test", "synthetic-test-key", {
      global: {
        fetch: async (input) =>
          Response.json(String(input).includes("/rpc/") ? false : snapshot),
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await expect(rydFulfillmentCsv(admin, snapshot.id)).rejects.toMatchObject({
      code: "RY409",
    });
  });
  it("downloads a prepared batch after checking its current eligibility", async () => {
    const admin = createClient("http://ryd.test", "synthetic-test-key", {
      global: {
        fetch: async (input) =>
          Response.json(
            String(input).includes("/rpc/")
              ? true
              : { ...snapshot, order_rows: snapshot.order_rows.slice(0, 1) },
          ),
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(parseCsv(await rydFulfillmentCsv(admin, snapshot.id)).rows).toEqual([
      ["1", "✅"],
    ]);
  });
  it("downloads only saved rows and decisions", async () => {
    const csv = await rydFulfillmentCsv(
      client({ ...snapshot, state: "sent" }, (url) => {
        expect(url.pathname).toContain("ryd_fulfillment_snapshots");
        expect(url.searchParams.get("id")).toBe(`eq.${snapshot.id}`);
      }),
      snapshot.id,
    );
    expect(parseCsv(csv).rows).toEqual([
      ["1", "✅"],
      ["2", ""],
    ]);
  });
  it("ticks only the form and response keys captured by the manifest", async () => {
    const result = await finishRydFulfillment(
      client({ changed: true, snapshot }),
      "actor",
      snapshot.id,
      "confirm",
    );
    expect(result).toMatchObject({
      changed: true,
      verifiedCount: 1,
      orderCount: 2,
      sheet: { responses: [{ key: "original-response", outcome: "updated" }] },
    });
    expect(google.read).toHaveBeenCalledWith(
      expect.anything(),
      "original-form",
      { fresh: true },
    );
    expect(google.tick).toHaveBeenCalledWith(
      expect.anything(),
      {
        linkedSheetId: "original-sheet",
        questionTitles: ["Your email"],
        submissions: [{ key: "original-response" }, { key: "later-response" }],
      },
      ["original-response"],
    );
  });
  it("does not repeat external work after an idempotent confirmation", async () => {
    const result = await finishRydFulfillment(
      client({ changed: false, snapshot }),
      "actor",
      snapshot.id,
      "confirm",
    );
    expect(google.load).not.toHaveBeenCalled();
    expect(result.sheet.issue).toBe("already-confirmed");
  });
  it("preserves a successful confirmation when Google is unavailable", async () => {
    google.load.mockResolvedValue(null);
    expect(
      await finishRydFulfillment(
        client({ changed: true, snapshot }),
        "actor",
        snapshot.id,
        "confirm",
      ),
    ).toMatchObject({
      changed: true,
      sheet: {
        issue: "disconnected",
        responses: [{ key: "original-response", outcome: "unchecked" }],
      },
    });
  });
  it("passes deleted pinned keys through to the missing-response report", async () => {
    google.read.mockResolvedValue({
      linkedSheetId: "sheet",
      questionTitles: ["Email"],
      submissions: [],
    });
    await finishRydFulfillment(
      client({ changed: true, snapshot }),
      "actor",
      snapshot.id,
      "confirm",
    );
    expect(google.tick).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ submissions: [] }),
      ["original-response"],
    );
  });
  it("keeps the saved confirmation when reading Google fails", async () => {
    google.read.mockRejectedValue(new Error("synthetic Google failure"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await finishRydFulfillment(
        client({ changed: true, snapshot }),
        "actor",
        snapshot.id,
        "confirm",
      );
      expect(result).toMatchObject({
        changed: true,
        sheet: {
          issue: "google-unavailable",
          responses: [{ outcome: "unchecked" }],
        },
      });
      expect(google.tick).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
  it("does not contact Google for cancellation or a batch without response keys", async () => {
    for (const [action, row] of [
      ["cancel", snapshot],
      ["confirm", { ...snapshot, response_keys: [] }],
    ] as const) {
      const result = await finishRydFulfillment(
        client({ changed: true, snapshot: row }),
        "actor",
        snapshot.id,
        action,
      );
      expect(result.sheet.issue).toBe("not-required");
    }
    expect(google.load).not.toHaveBeenCalled();
  });
  it.each([
    {},
    { action: "confirm" },
    { action: "prepare", orderIds: ["1"] },
    { action: "cancel", snapshotId: "bad" },
  ])("rejects invalid batch requests: %o", (value) => {
    expect(rydBatchSchema(value)).toBeNull();
  });
});
