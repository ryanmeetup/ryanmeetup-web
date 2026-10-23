import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseCsv } from "@/lib/ryd/csv";
import type { RydSubmission } from "@/lib/ryd/matching";

const readRydSubmissions = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/ryd-google", () => ({
  loadRydGoogleIntegration: async () => ({ account_email: "form@example.com" }),
  readRydSubmissions,
}));

type Row = Record<string, unknown>;

/** Exercise the real PostgREST query builder against a capped, synthetic API. */
function database(tables: Record<string, Row[]>, failAt?: number) {
  const fetcher = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const name = url.pathname.split("/").at(-1)!;
      const offset = Number(url.searchParams.get("offset") ?? 0);
      if (name === "ryd_orders" && offset === failAt)
        return Response.json(
          { code: "08006", message: "connection lost" },
          { status: 400 },
        );
      const all = tables[name] ?? [];
      if (init?.method === "HEAD")
        return new Response(null, {
          headers: { "content-range": `0-0/${all.length}` },
        });
      const limit = Math.min(
        Number(url.searchParams.get("limit") ?? 1000),
        1000,
      );
      const rows = all.slice(offset, offset + limit);
      const single = new Headers(init?.headers)
        .get("accept")
        ?.includes("pgrst.object");
      return Response.json(single ? (rows[0] ?? null) : rows);
    },
  );
  return createClient("http://ryd.test", "synthetic-test-key", {
    global: { fetch: fetcher },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function orders(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    order_id: String(index + 1),
    sales_order: "",
    ordered_at: "",
    first_name: "Ryan",
    last_name: `Example ${index}`,
    email: `ryan${index}@example.com`,
    raw: {
      OrderId: String(index + 1),
      " billemail ": `Ryan${index}@example.com`,
      ordertotal: "36.75",
    },
    status: "pending",
    note: null,
    decided_at: null,
    decided_by: null,
    cleared_batch_id: null,
    last_emailed_at: null,
    created_at: "2026-10-20T12:00:00Z",
  }));
}

describe("RY-D complete collection reads", () => {
  beforeEach(() => readRydSubmissions.mockResolvedValue({ submissions: [] }));

  it("rejects a successful response that omits its required rows", async () => {
    const { readRydRows } = await import("@/lib/server/ryd-queries");
    await expect(readRydRows(async () => ({ data: null, error: null })))
      .rejects.toThrow("returned no data");
  });

  it("exports every immutable manifest row beyond the Data API cap", async () => {
    const { rydFulfillmentCsv } = await import("@/lib/server/ryd-fulfillment");
    const csv = await rydFulfillmentCsv(
      database({
        ryd_fulfillment_snapshots: [
          {
            state: "sent",
            headers: ["OrderId", "Verified?"],
            order_rows: orders(1005),
          },
        ],
      }),
      "00000000-0000-4000-8000-000000000301",
    );
    expect(parseCsv(csv).rows).toHaveLength(1005);
    expect(parseCsv(csv).rows.at(-1)?.[0]).toBe("1005");
  });

  it("loads enough saved-batch metadata to resume after a page reload", async () => {
    const { loadRydQueue } = await import("@/lib/server/ryd");
    const queue = await loadRydQueue(
      database({
        ryd_orders: orders(2),
        ryd_settings: [{ form_id: "f".repeat(30) }],
        ryd_fulfillment_snapshots: [
          { id: "saved-batch", verified_ids: ["1", "2"], state: "prepared" },
        ],
      }),
    );
    expect(queue.preparedBatch).toEqual({
      id: "saved-batch",
      verifiedCount: 2,
    });
  });

  it("keeps links, removed responses, and contact counts beyond the first page", async () => {
    const submissions: RydSubmission[] = ["linked", "removed"].map((key) => ({
      key,
      email: `${key}@example.com`,
      legalName: "Ryan Example",
      submittedAt: "",
      submittedAtIso: "",
      fileIds: [],
      socialLinks: [],
      socialText: "",
      otherAnswers: [],
    }));
    readRydSubmissions.mockResolvedValue({ submissions });
    const { loadRydQueue } = await import("@/lib/server/ryd");
    const queue = await loadRydQueue(
      database({
        ryd_orders: orders(1005),
        ryd_settings: [{ form_id: "f".repeat(30) }],
        ryd_order_submissions: [
          ...Array.from({ length: 1000 }, (_, i) => ({
            order_id: String(i + 1),
            submission_key: `s${i}`,
          })),
          { order_id: "1005", submission_key: "linked" },
        ],
        ryd_dismissed_submissions: [
          ...Array.from({ length: 1000 }, (_, i) => ({
            submission_key: `removed${i}`,
          })),
          { submission_key: "removed" },
        ],
        ryd_submitter_contacts: Array.from({ length: 1005 }, (_, i) => ({
          email: "unmatched@example.com",
          contacted_at:
            i === 1004 ? "2026-10-20T12:00:00Z" : "2026-10-19T12:00:00Z",
        })),
      }),
    );
    expect(queue.orders).toHaveLength(1005);
    expect(queue.orders.at(-1)).toMatchObject({
      linkedKeys: ["linked"],
      displayEmail: "Ryan1004@example.com",
      total: "36.75",
    });
    expect(queue.dismissed.map((s) => s.key)).toEqual(["removed"]);
    expect(queue.contacts["unmatched@example.com"]).toEqual({
      attempts: 1005,
      lastContactedAt: "2026-10-20T12:00:00Z",
    });
  });

  it("propagates a later-page failure instead of returning a partial queue", async () => {
    const { loadRydQueue } = await import("@/lib/server/ryd");
    await expect(
      loadRydQueue(database({ ryd_orders: orders(1005) }, 500)),
    ).rejects.toMatchObject({ code: "08006" });
  });

  it.each([5000, 5001])(
    "reports the MCP cap accurately with %i orders",
    async (count) => {
      const { loadRydProfiles } = await import("@/lib/server/mcp/ryd-read");
      const loaded = await loadRydProfiles(
        database({
          instance_settings: [{ ryd_enabled: true }],
          ryd_orders: orders(count),
        }),
      );
      expect(loaded.available).toBe(true);
      if (!loaded.available) return;
      expect(loaded.profiles).toHaveLength(5000);
      expect(loaded.profiles[0].total).toBe(36.75);
      expect(loaded.capped).toBe(count > 5000);
    },
  );
});
