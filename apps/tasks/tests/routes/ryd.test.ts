import { beforeEach, describe, expect, it, vi } from "vitest";

const authorize = vi.fn();
const getInstanceSettings = vi.fn();
const getAdminClient = vi.fn();
const loadRydGoogleIntegration = vi.fn();
const readRydSubmissions = vi.fn();
const fetchRydEvidence = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/auth", () => ({ authorize }));
vi.mock("@/lib/server/instance-settings", () => ({ getInstanceSettings }));
vi.mock("@/lib/server/admin-client", () => ({ getAdminClient }));
vi.mock("@/lib/server/ryd-google", () => ({
  loadRydGoogleIntegration,
  readRydSubmissions,
  fetchRydEvidence,
  markRydSubmissionsVerified: vi.fn(),
}));

/** A query builder that answers every chain with the same result. */
function table(result: unknown, calls: unknown[] = []) {
  const builder: Record<string, unknown> = {};
  for (const method of [
    "select",
    "eq",
    "in",
    "is",
    "not",
    "order",
    "limit",
    "update",
    "insert",
    "upsert",
    "delete",
  ])
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  builder.maybeSingle = () => Promise.resolve(result);
  builder.single = () => Promise.resolve(result);
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return builder;
}

function admin(tables: Record<string, ReturnType<typeof table>>) {
  return {
    from: (name: string) => tables[name] ?? table({ data: null, error: null }),
  };
}

const json = (body: unknown, method = "PATCH") => ({
  method,
  headers: { origin: "http://localhost", "content-type": "application/json" },
  body: JSON.stringify(body),
});

const member = { user: { id: "member-1" }, supabase: {} };

describe("RY-D routes", () => {
  beforeEach(() => {
    vi.resetModules();
    authorize.mockReset().mockResolvedValue(member);
    getInstanceSettings.mockReset().mockResolvedValue({ rydEnabled: true });
    getAdminClient.mockReset();
    loadRydGoogleIntegration.mockReset();
    readRydSubmissions.mockReset();
    fetchRydEvidence.mockReset();
  });

  it("does not exist on an instance with RY-D off", async () => {
    getInstanceSettings.mockResolvedValue({ rydEnabled: false });
    const { GET } = await import("@/app/api/ryd/route");

    const response = await GET();

    expect(response.status).toBe(404);
    expect(authorize).not.toHaveBeenCalled();
  });

  it("requires RY-D page access for both the queue and settings", async () => {
    authorize.mockResolvedValue({
      response: Response.json({}, { status: 403 }),
    });
    const queue = await import("@/app/api/ryd/route");
    const settings = await import("@/app/api/ryd/settings/route");

    expect((await queue.GET()).status).toBe(403);
    expect(authorize).toHaveBeenLastCalledWith({
      onboarded: true,
      area: "ryd",
    });
    const saved = await settings.PATCH(
      new Request(
        "http://localhost/api/ryd/settings",
        json({ fulfillmentEmail: "orders@example.com" }),
      ),
    );
    expect(saved.status).toBe(403);
    expect(authorize).toHaveBeenLastCalledWith({
      onboarded: true,
      area: "ryd",
    });
  });

  it("lets a RY-D member save settings without app ownership", async () => {
    const calls: unknown[] = [];
    getAdminClient.mockReturnValue(
      admin({
        ryd_settings: table(
          {
            data: {
              form_id: "f".repeat(30),
              fulfillment_email: "orders@example.com",
            },
            error: null,
          },
          calls,
        ),
      }),
    );
    const { PATCH } = await import("@/app/api/ryd/settings/route");

    const response = await PATCH(
      new Request(
        "http://localhost/api/ryd/settings",
        json({ fulfillmentEmail: "orders@example.com" }),
      ),
    );

    expect(response.status).toBe(200);
    expect(authorize).toHaveBeenCalledExactlyOnceWith({
      onboarded: true,
      area: "ryd",
    });
    expect(calls).toContainEqual([
      "upsert",
      expect.objectContaining({
        fulfillment_email: "orders@example.com",
        updated_by: member.user.id,
      }),
    ]);
  });

  it("refuses to change the decision on an order already sent as verified", async () => {
    getAdminClient.mockReturnValue(
      admin({
        ryd_orders: table({
          data: { status: "verified", note: null, cleared_batch_id: "batch-1" },
          error: null,
        }),
      }),
    );
    const { PATCH } = await import("@/app/api/ryd/orders/[orderId]/route");

    const response = await PATCH(
      new Request(
        "http://localhost/api/ryd/orders/1001",
        json({ status: "rejected" }),
      ),
      { params: Promise.resolve({ orderId: "1001" }) },
    );

    expect(response.status).toBe(409);
  });

  it("rejects an unknown decision", async () => {
    const { PATCH } = await import("@/app/api/ryd/orders/[orderId]/route");

    const response = await PATCH(
      new Request(
        "http://localhost/api/ryd/orders/1001",
        json({ status: "maybe" }),
      ),
      { params: Promise.resolve({ orderId: "1001" }) },
    );

    expect(response.status).toBe(400);
    expect(authorize).not.toHaveBeenCalled();
  });

  it("only serves Drive files the form's responses name", async () => {
    getAdminClient.mockReturnValue(
      admin({
        ryd_settings: table({
          data: { form_id: "f".repeat(30), fulfillment_email: null },
          error: null,
        }),
      }),
    );
    loadRydGoogleIntegration.mockResolvedValue({
      account_email: "form@example.com",
    });
    readRydSubmissions.mockResolvedValue({
      submissions: [{ fileIds: ["listedFile123"] }],
    });
    fetchRydEvidence.mockResolvedValue({
      body: "image-bytes",
      name: "ryan.png",
      mimeType: "image/png",
      inline: true,
    });
    const { GET } = await import("@/app/api/ryd/evidence/[fileId]/route");

    const unlisted = await GET(new Request("http://localhost/"), {
      params: Promise.resolve({ fileId: "someoneElsesFile" }),
    });
    const listed = await GET(new Request("http://localhost/"), {
      params: Promise.resolve({ fileId: "listedFile123" }),
    });

    expect(unlisted.status).toBe(404);
    expect(fetchRydEvidence).toHaveBeenCalledTimes(1);
    expect(listed.status).toBe(200);
    expect(listed.headers.get("content-type")).toBe("image/png");
    expect(listed.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects an upload from another origin", async () => {
    const { POST } = await import("@/app/api/ryd/imports/route");

    const response = await POST(
      new Request("http://localhost/api/ryd/imports", {
        method: "POST",
        headers: { origin: "https://elsewhere.example" },
        body: new FormData(),
      }),
    );

    expect(response.status).toBe(403);
    expect(authorize).not.toHaveBeenCalled();
  });

  it("won't remove a response that already vouches for an order", async () => {
    const calls: unknown[] = [];
    getAdminClient.mockReturnValue(
      admin({
        ryd_order_submissions: table({
          data: { order_id: "1001" },
          error: null,
        }),
        ryd_dismissed_submissions: table({ data: null, error: null }, calls),
      }),
    );
    const { POST } = await import("@/app/api/ryd/dismissals/route");

    const response = await POST(
      new Request(
        "http://localhost/api/ryd/dismissals",
        json({ submissionKey: "response-1" }, "POST"),
      ),
    );

    expect(response.status).toBe(409);
    expect(calls).toEqual([]);
  });

  it("removes an unlinked response, recording who did it", async () => {
    const calls: unknown[] = [];
    getAdminClient.mockReturnValue(
      admin({
        ryd_order_submissions: table({ data: null, error: null }),
        ryd_dismissed_submissions: table({ data: null, error: null }, calls),
      }),
    );
    const { POST } = await import("@/app/api/ryd/dismissals/route");

    const response = await POST(
      new Request(
        "http://localhost/api/ryd/dismissals",
        json({ submissionKey: "response-1" }, "POST"),
      ),
    );

    expect(response.status).toBe(200);
    expect(calls[0]).toEqual([
      "upsert",
      { submission_key: "response-1", dismissed_by: "member-1" },
      { onConflict: "submission_key", ignoreDuplicates: true },
    ]);
  });

  it("says a pending migration blocks removing before the table exists", async () => {
    getAdminClient.mockReturnValue(
      admin({
        ryd_order_submissions: table({ data: null, error: null }),
        ryd_dismissed_submissions: table({
          data: null,
          error: { code: "42P01", message: "missing" },
        }),
      }),
    );
    const { POST, DELETE } = await import("@/app/api/ryd/dismissals/route");
    const body = json({ submissionKey: "response-1" }, "POST");

    const removed = await POST(
      new Request("http://localhost/api/ryd/dismissals", body),
    );
    const restored = await DELETE(
      new Request("http://localhost/api/ryd/dismissals", {
        ...body,
        method: "DELETE",
      }),
    );

    expect(removed.status).toBe(503);
    expect(restored.status).toBe(503);
  });

  it("restores a removed response", async () => {
    const calls: unknown[] = [];
    getAdminClient.mockReturnValue(
      admin({
        ryd_dismissed_submissions: table({ data: null, error: null }, calls),
      }),
    );
    const { DELETE } = await import("@/app/api/ryd/dismissals/route");

    const response = await DELETE(
      new Request(
        "http://localhost/api/ryd/dismissals",
        json({ submissionKey: "response-1" }, "DELETE"),
      ),
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual([["delete"], ["eq", "submission_key", "response-1"]]);
  });
  it("records drafted reminders only on orders still waiting on the buyer", async () => {
    const calls: unknown[] = [];
    getAdminClient.mockReturnValue(
      admin({
        ryd_orders: table(
          {
            data: [{ order_id: "1001", email: "ryan@example.com" }],
            error: null,
          },
          calls,
        ),
      }),
    );
    const { POST } = await import("@/app/api/ryd/reminders/route");

    const response = await POST(
      new Request(
        "http://localhost/api/ryd/reminders",
        json({ orderIds: ["1001", "1002", "1001"] }, "POST"),
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ markedCount: 1 });
    expect(calls).toContainEqual(["in", "order_id", ["1001", "1002"]]);
    expect(calls).toContainEqual(["in", "status", ["pending", "needs_info"]]);
    expect(calls).toContainEqual(["is", "cleared_batch_id", null]);
  });

  it("refuses to change the decision on an order in production", async () => {
    getAdminClient.mockReturnValue(
      admin({
        ryd_orders: table({
          data: {
            status: "verified",
            note: null,
            cleared_batch_id: null,
            production_sent_at: "2026-10-18T15:00:00Z",
          },
          error: null,
        }),
      }),
    );
    const { PATCH } = await import("@/app/api/ryd/orders/[orderId]/route");

    const response = await PATCH(
      new Request(
        "http://localhost/api/ryd/orders/1001",
        json({ status: "needs_info" }),
      ),
      { params: Promise.resolve({ orderId: "1001" }) },
    );

    expect(response.status).toBe(409);
  });

  it("marks verified orders done, stamping a missing sent date first", async () => {
    const calls: unknown[] = [];
    getAdminClient.mockReturnValue(
      admin({
        ryd_orders: table({ data: [{ order_id: "1001" }], error: null }, calls),
      }),
    );
    const { POST } = await import("@/app/api/ryd/production/route");

    const response = await POST(
      new Request(
        "http://localhost/api/ryd/production",
        json({ orderIds: ["1001", "1001"], stage: "done" }, "POST"),
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ movedCount: 1 });
    const updates = calls.filter(
      (call): call is [string, Record<string, unknown>] =>
        (call as unknown[])[0] === "update",
    );
    expect(Object.keys(updates[0][1])).toContain("production_sent_at");
    expect(Object.keys(updates[1][1])).toContain("done_at");
    expect(calls).toContainEqual(["in", "order_id", ["1001"]]);
    expect(calls).toContainEqual(["eq", "status", "verified"]);
    expect(calls).toContainEqual(["is", "production_sent_at", null]);
    expect(calls).toContainEqual(["is", "done_at", null]);
  });

  it("rejects an unknown production stage", async () => {
    const { POST } = await import("@/app/api/ryd/production/route");

    const response = await POST(
      new Request(
        "http://localhost/api/ryd/production",
        json({ orderIds: ["1001"], stage: "shipped" }, "POST"),
      ),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a reminder request with no orders", async () => {
    const { POST } = await import("@/app/api/ryd/reminders/route");

    const response = await POST(
      new Request(
        "http://localhost/api/ryd/reminders",
        json({ orderIds: [] }, "POST"),
      ),
    );

    expect(response.status).toBe(400);
  });

  it("records one contact attempt per unmatched submitter, normalized", async () => {
    const calls: unknown[] = [];
    getAdminClient.mockReturnValue(
      admin({
        ryd_submitter_contacts: table({ data: null, error: null }, calls),
      }),
    );
    const { POST } = await import("@/app/api/ryd/submitter-contacts/route");

    const response = await POST(
      new Request(
        "http://localhost/api/ryd/submitter-contacts",
        json(
          { emails: ["Ryan@Example.com ", "ryan@example.com", "b@x.dev"] },
          "POST",
        ),
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.markedCount).toBe(2);
    const [method, rows] = calls[0] as [string, Record<string, unknown>[]];
    expect(method).toBe("insert");
    expect(rows.map((row) => [row.email, row.contacted_by])).toEqual([
      ["ryan@example.com", "member-1"],
      ["b@x.dev", "member-1"],
    ]);
  });

  it("says a pending migration blocks marking contacts before the table exists", async () => {
    getAdminClient.mockReturnValue(
      admin({
        ryd_submitter_contacts: table({
          data: null,
          error: { code: "42P01", message: "missing" },
        }),
      }),
    );
    const { POST } = await import("@/app/api/ryd/submitter-contacts/route");

    const response = await POST(
      new Request(
        "http://localhost/api/ryd/submitter-contacts",
        json({ emails: ["ryan@example.com"] }, "POST"),
      ),
    );

    expect(response.status).toBe(503);
  });

  it("rejects a contact request with no emails", async () => {
    const { POST } = await import("@/app/api/ryd/submitter-contacts/route");

    const response = await POST(
      new Request(
        "http://localhost/api/ryd/submitter-contacts",
        json({ emails: [] }, "POST"),
      ),
    );

    expect(response.status).toBe(400);
  });

  it("marks a batch sent, clearing only the orders the reviewer drafted", async () => {
    const orderCalls: unknown[] = [];
    const batchCalls: unknown[] = [];
    getAdminClient.mockReturnValue(
      admin({
        ryd_settings: table({
          data: { form_id: null, fulfillment_email: "toney@example.com" },
          error: null,
        }),
        ryd_imports: table({ data: { headers: ["OrderId"] }, error: null }),
        ryd_orders: table(
          {
            data: [
              {
                order_id: "1001",
                raw: { OrderId: "1001" },
                status: "verified",
              },
              {
                order_id: "1002",
                raw: { OrderId: "1002" },
                status: "verified",
              },
              { order_id: "1003", raw: { OrderId: "1003" }, status: "pending" },
            ],
            error: null,
          },
          orderCalls,
        ),
        ryd_fulfillment_batches: table({ data: null, error: null }, batchCalls),
      }),
    );
    loadRydGoogleIntegration.mockResolvedValue(null);
    const { POST } = await import("@/app/api/ryd/batches/route");

    const response = await POST(
      new Request(
        "http://localhost/api/ryd/batches",
        json({ orderIds: ["1001"] }, "POST"),
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      orderCount: 3,
      verifiedCount: 1,
    });
    expect(batchCalls[0]).toEqual([
      "insert",
      expect.objectContaining({
        recipient: "toney@example.com",
        order_count: 3,
        verified_count: 1,
      }),
    ]);
    expect(orderCalls).toContainEqual(["in", "order_id", ["1001"]]);
  });
});
