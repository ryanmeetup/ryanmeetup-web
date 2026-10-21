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
    submissions: [{ key: "original-response" }, { key: "later-response" }],
  });
  google.tick.mockResolvedValue(1);
});

describe("RY-D immutable fulfillment manifests", () => {
  it("builds its draft from the manifest's ready rows", async () => {
    const draft = await prepareRydFulfillment(client(snapshot), "actor");
    expect(draft).toMatchObject({
      id: snapshot.id,
      recipient: snapshot.recipient,
      orderCount: 2,
      verifiedCount: 1,
    });
    expect(draft.draft.body).toContain("1 · Ryan One");
    expect(draft.draft.body).toContain(`Batch: ${snapshot.id}`);
    expect(draft.draft.body).not.toContain("Ryan Two");
  });
  it("downloads only saved rows and decisions", async () => {
    const csv = await rydFulfillmentCsv(
      client(snapshot, (url) => {
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
      sheetTicks: 1,
    });
    expect(google.read).toHaveBeenCalledWith(
      expect.anything(),
      "original-form",
      { fresh: true },
    );
    expect(google.tick).toHaveBeenCalledWith(
      expect.anything(),
      "original-sheet",
      [{ key: "original-response" }],
    );
  });
  it("does not repeat external work after an idempotent confirmation", async () => {
    await finishRydFulfillment(
      client({ changed: false, snapshot }),
      "actor",
      snapshot.id,
      "confirm",
    );
    expect(google.load).not.toHaveBeenCalled();
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
    ).toMatchObject({ changed: true, sheetTicks: null });
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
