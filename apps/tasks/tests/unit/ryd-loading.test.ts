import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RydSubmission } from "@/lib/ryd/matching";

const readRydSubmissions = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/ryd-google", () => ({
  loadRydGoogleIntegration: async () => ({ account_email: "form@example.com" }),
  readRydSubmissions,
}));

type Row = Record<string, unknown>;

/** Exercise the real PostgREST query builder against a capped, synthetic API. */
function database(
  tables: Record<string, Row[]>,
  failAt?: number,
  requests: URL[] = [],
) {
  const fetcher = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      requests.push(url);
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
    await expect(
      readRydRows(async () => ({ data: null, error: null })),
    ).rejects.toThrow("returned no data");
  });

  it("ignores historical saved drafts while loading the manual queue", async () => {
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
    expect(queue).not.toHaveProperty("preparedBatch");
    expect(queue.orders).toHaveLength(2);
  });

  it("does not load unused cleared counts or legacy fulfillment batches", async () => {
    const { loadRydQueue } = await import("@/lib/server/ryd");
    const requests: URL[] = [];
    const queue = await loadRydQueue(
      database({ ryd_orders: orders(2) }, undefined, requests),
    );

    expect(
      requests.some((url) => url.pathname.endsWith("/ryd_fulfillment_batches")),
    ).toBe(false);
    // The queue read, then the count of older done orders.
    expect(
      requests.filter((url) => url.pathname.endsWith("/ryd_orders")),
    ).toHaveLength(2);
    expect(queue).not.toHaveProperty("clearedCount");
    expect(queue).not.toHaveProperty("lastBatch");
    expect(queue.orders).toHaveLength(2);
  });

  it("counts orders done before the window instead of loading them", async () => {
    const { loadRydQueue } = await import("@/lib/server/ryd");
    const requests: URL[] = [];
    const queue = await loadRydQueue(
      database({ ryd_orders: orders(3) }, undefined, requests),
    );

    const [read, ...rest] = requests.filter((url) =>
      url.pathname.endsWith("/ryd_orders"),
    );
    expect(read.searchParams.getAll("or")).toEqual([
      "(cleared_batch_id.is.null,status.eq.verified)",
      `(done_at.is.null,done_at.gte.${queue.olderDone?.before})`,
    ]);
    expect(read.searchParams.get("select")).not.toBe("*");
    expect(rest.map((url) => url.searchParams.get("done_at"))).toEqual([
      `lt.${queue.olderDone?.before}`,
    ]);
    expect(queue.olderDone).toEqual({ before: expect.any(String), count: 3 });
    expect(
      Date.now() - Date.parse(queue.olderDone!.before) - 30 * 86_400_000,
    ).toBeLessThan(60_000);
  });

  it("loads every done order when asked for older ones", async () => {
    const { loadRydQueue } = await import("@/lib/server/ryd");
    const requests: URL[] = [];
    const queue = await loadRydQueue(
      database({ ryd_orders: orders(3) }, undefined, requests),
      { olderDone: true },
    );

    const reads = requests.filter((url) =>
      url.pathname.endsWith("/ryd_orders"),
    );
    expect(reads).toHaveLength(1);
    expect(reads[0].searchParams.getAll("or")).toEqual([
      "(cleared_batch_id.is.null,status.eq.verified)",
    ]);
    expect(queue.olderDone).toBeNull();
    expect(queue.orders).toHaveLength(3);
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
