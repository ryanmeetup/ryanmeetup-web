import { beforeEach, describe, expect, it, vi } from "vitest";

const authorize = vi.fn();
const getInstanceSettings = vi.fn();
const getAdminClient = vi.fn();
const loadRydGoogleIntegration = vi.fn();
const readRydSubmissions = vi.fn();
const fetchRydEvidence = vi.fn();
const rpc = vi.fn();

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
    "range",
    "or",
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
    from: (name: string) =>
      tables[name] ??
      table({
        data:
          name === "ryd_settings"
            ? { form_id: "f".repeat(30) }
            : [
                  "ryd_orders",
                  "ryd_order_submissions",
                  "ryd_dismissed_submissions",
                  "ryd_submitter_contacts",
                ].includes(name)
              ? []
              : null,
        error: null,
      }),
    rpc,
  };
}

const json = (body: unknown, method = "PATCH") => ({
  method,
  headers: { origin: "http://localhost", "content-type": "application/json" },
  body: JSON.stringify(body),
});

// Granted RY-D Settings as well as the queue.
const canViewSettings = vi.fn();
const member = { user: { id: "member-1" }, supabase: { rpc: canViewSettings } };

describe("RY-D routes", () => {
  beforeEach(() => {
    vi.resetModules();
    authorize.mockReset().mockResolvedValue(member);
    canViewSettings.mockReset().mockResolvedValue({ data: true, error: null });
    getInstanceSettings.mockReset().mockResolvedValue({ rydEnabled: true });
    getAdminClient.mockReset();
    loadRydGoogleIntegration
      .mockReset()
      .mockResolvedValue({ account_email: "form@example.com" });
    readRydSubmissions
      .mockReset()
      .mockResolvedValue({ submissions: [{ key: "response-1", fileIds: [] }] });
    rpc
      .mockReset()
      .mockResolvedValue({ data: { ok: true, changed: true }, error: null });
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

  it("refuses settings to a member with the queue but not RY-D Settings", async () => {
    canViewSettings.mockResolvedValue({ data: false, error: null });
    getAdminClient.mockReturnValue(admin({}));
    const { PATCH } = await import("@/app/api/ryd/settings/route");

    const response = await PATCH(
      new Request(
        "http://localhost/api/ryd/settings",
        json({ fulfillmentEmail: "orders@example.com" }),
      ),
    );

    expect(response.status).toBe(403);
    expect(canViewSettings).toHaveBeenCalledWith("can_view_workspace_area", {
      requested_area: "ryd-settings",
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
    expect(calls.filter((call) => (call as unknown[])[0] === "select")).toEqual(
      [["select", "*"]],
    );
    expect(await response.json()).toMatchObject({
      formId: "f".repeat(30),
      fulfillmentEmail: "orders@example.com",
    });
  });

  it("refuses to change the decision on an order already sent as verified", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "RY409",
        message:
          "This order is already with fulfillment or in production. Its decision cannot be changed.",
      },
    });
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

  it("validates every suggested response before dispatching one review transaction", async () => {
    const result = { ok: true, order: { order_id: "1001", status: "verified", note: "Checked", decided_at: "now", decided_by: member.user.id, updated_at: "new-revision" } };
    rpc.mockResolvedValue({ data: result, error: null });
    getAdminClient.mockReturnValue(admin({}));
    const { PATCH } = await import("@/app/api/ryd/orders/[orderId]/route");
    const response = await PATCH(
      new Request(
        "http://localhost/api/ryd/orders/1001",
        json({
          status: "verified",
          expectedStatus: "pending",
          submissionKeys: ["response-1"],
        }),
      ),
      { params: Promise.resolve({ orderId: "1001" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("ryd_review_order", {
      requested_actor: "member-1",
      requested_order: "1001",
      requested_patch: { status: "verified", expectedStatus: "pending" },
      requested_form: "f".repeat(30),
      requested_keys: ["response-1"],
    });
    expect(readRydSubmissions).toHaveBeenCalledWith(
      expect.anything(),
      "f".repeat(30),
      { fresh: true },
    );
  });

  it("links a submitter's responses with one provenance check and one transaction", async () => {
    getAdminClient.mockReturnValue(admin({}));
    readRydSubmissions.mockResolvedValue({
      submissions: [{ key: "response-1" }, { key: "response-2" }],
    });
    const { POST } = await import("@/app/api/ryd/orders/[orderId]/links/route");
    const response = await POST(
      new Request(
        "http://localhost/api/ryd/orders/1001/links",
        json(
          { submissionKeys: ["response-1", "response-2"], source: "manual" },
          "POST",
        ),
      ),
      { params: Promise.resolve({ orderId: "1001" }) },
    );
    expect(response.status).toBe(200);
    expect(readRydSubmissions).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("ryd_link_submissions", {
      requested_actor: "member-1",
      requested_order: "1001",
      requested_keys: ["response-1", "response-2"],
      requested_form: "f".repeat(30),
      requested_source: "manual",
    });
  });

  it("does not persist a response ID from outside the configured form", async () => {
    getAdminClient.mockReturnValue(admin({}));
    const { POST } = await import("@/app/api/ryd/orders/[orderId]/links/route");
    const response = await POST(
      new Request(
        "http://localhost/api/ryd/orders/1001/links",
        json(
          {
            submissionKey: "unlisted-response",
            source: "manual",
          },
          "POST",
        ),
      ),
      { params: Promise.resolve({ orderId: "1001" }) },
    );
    expect(response.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
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
      name: 'Ryan 的照片 "one".png',
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
    expect(listed.headers.get("content-disposition")).toContain(
      "filename*=UTF-8''Ryan%20",
    );
    expect(listed.headers.get("content-disposition")).toContain("%E7%9A%84");
    expect(readRydSubmissions).toHaveBeenLastCalledWith(
      expect.anything(),
      "f".repeat(30),
      { signal: expect.any(AbortSignal) },
    );
    expect(fetchRydEvidence).toHaveBeenCalledWith(
      expect.anything(),
      "listedFile123",
      expect.any(AbortSignal),
    );
  });

  it.each(["anonymous", "denied", "feature-off", "disconnected", "form-changed"])(
    "rechecks %s access or provenance on subsequent evidence requests",
    async (change) => {
      getAdminClient.mockReturnValue(admin({}));
      readRydSubmissions.mockResolvedValue({
        submissions: [{ fileIds: ["listedFile123"] }],
      });
      fetchRydEvidence.mockImplementation(async () => ({
        body: "synthetic image",
        name: "synthetic.png",
        mimeType: "image/png",
        inline: true,
      }));
      const { GET } = await import("@/app/api/ryd/evidence/[fileId]/route");
      const request = () =>
        GET(new Request("http://localhost/"), {
          params: Promise.resolve({ fileId: "listedFile123" }),
        });
      expect((await request()).status).toBe(200);
      if (change === "anonymous" || change === "denied")
        authorize.mockResolvedValue({
          response: Response.json({}, { status: change === "anonymous" ? 401 : 403 }),
        });
      if (change === "feature-off")
        getInstanceSettings.mockResolvedValue({ rydEnabled: false });
      if (change === "disconnected")
        loadRydGoogleIntegration.mockResolvedValue(null);
      if (change === "form-changed") {
        getAdminClient.mockReturnValue(
          admin({
            ryd_settings: table({ data: { form_id: "new-form" }, error: null }),
          }),
        );
        readRydSubmissions.mockResolvedValue({ submissions: [] });
      }
      const expectedStatus = change === "anonymous" ? 401 : change === "denied" ? 403 : 404;
      expect((await request()).status).toBe(expectedStatus);
      expect(fetchRydEvidence).toHaveBeenCalledTimes(1);
    },
  );

  it("forwards an explicit queue refresh and cancellation to Google", async () => {
    getAdminClient.mockReturnValue(admin({}));
    readRydSubmissions.mockResolvedValue({ submissions: [] });
    const { GET } = await import("@/app/api/ryd/route");
    const request = new Request("http://localhost/api/ryd", {
      headers: { "cache-control": "no-cache" },
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(readRydSubmissions).toHaveBeenCalledWith(
      expect.anything(),
      "f".repeat(30),
      { signal: request.signal, fresh: true },
    );
  });

  it("ends a cancelled evidence request without downloading media", async () => {
    getAdminClient.mockReturnValue(admin({}));
    const controller = new AbortController();
    controller.abort();
    readRydSubmissions.mockRejectedValue(controller.signal.reason);
    const { GET } = await import("@/app/api/ryd/evidence/[fileId]/route");
    const response = await GET(
      new Request("http://localhost/", { signal: controller.signal }),
      { params: Promise.resolve({ fileId: "listedFile123" }) },
    );
    expect(response.status).toBe(499);
    expect(fetchRydEvidence).not.toHaveBeenCalled();
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

  it("imports the parsed file and its operation key through one transaction", async () => {
    getAdminClient.mockReturnValue(admin({}));
    rpc.mockResolvedValue({
      data: { ok: true, newCount: 1, rowCount: 1 },
      error: null,
    });
    const { POST } = await import("@/app/api/ryd/imports/route");
    const form = new FormData();
    form.set("operationId", "30000000-0000-4000-8000-000000000401");
    form.set(
      "file",
      new File(
        [
          "OrderId,BillFirstName,BillLastName,BillEmail,Verified?\n1001,Ryan,Example,Ryan@example.test,✅\n",
        ],
        "orders.csv",
      ),
    );
    const response = await POST(
      new Request("http://localhost/api/ryd/imports", {
        method: "POST",
        headers: { origin: "http://localhost" },
        body: form,
      }),
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("ryd_import_orders", {
      requested_actor: "member-1",
      requested_operation: "30000000-0000-4000-8000-000000000401",
      requested_payload: expect.objectContaining({
        filename: "orders.csv",
        orders: [
          expect.objectContaining({
            orderId: "1001",
            email: "ryan@example.test",
            // A tick left in fulfillment's file is not a decision.
            verified: false,
          }),
        ],
      }),
    });
  });

  it.each([undefined, "1"])(
    "stops oversized streamed uploads before multipart parsing with length %s",
    async (length) => {
      getAdminClient.mockReturnValue(admin({}));
      const cancel = vi.fn();
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 64 * 1024 + 1));
        },
        cancel,
      });
      const { POST } = await import("@/app/api/ryd/imports/route");
      const response = await POST(
        new Request("http://localhost/api/ryd/imports", {
          method: "POST",
          headers: {
            origin: "http://localhost",
            "content-type": "multipart/form-data; boundary=synthetic",
            ...(length ? { "content-length": length } : {}),
          },
          body,
          duplex: "half",
        } as RequestInit & { duplex: string }),
      );
      expect(response.status).toBe(413);
      expect(cancel).toHaveBeenCalledOnce();
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it("rejects a damaged CSV before making any database writes", async () => {
    getAdminClient.mockReturnValue(admin({}));
    const { POST } = await import("@/app/api/ryd/imports/route");
    const form = new FormData();
    form.set("operationId", "30000000-0000-4000-8000-000000000401");
    form.set(
      "file",
      new File(
        [
          'OrderId,BillFirstName,BillLastName,BillEmail,Verified?\n1001,"unclosed',
        ],
        "bad.csv",
      ),
    );
    const response = await POST(
      new Request("http://localhost/api/ryd/imports", {
        method: "POST",
        headers: { origin: "http://localhost" },
        body: form,
      }),
    );
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("won't remove a response that already vouches for an order", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "RY409",
        message:
          "That response is already linked to an order. Unlink it there first.",
      },
    });
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
    expect(rpc).toHaveBeenCalledWith(
      "ryd_change_submission",
      expect.objectContaining({
        requested_key: "response-1",
        requested_actor: "member-1",
        requested_action: "dismiss",
        requested_form: "f".repeat(30),
      }),
    );
    expect(calls).toEqual([]);
  });

  it("says a pending migration blocks removing before the RPC exists", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
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
    expect(rpc).toHaveBeenCalledWith(
      "ryd_change_submission",
      expect.objectContaining({
        requested_key: "response-1",
        requested_actor: "member-1",
        requested_action: "restore",
      }),
    );
    expect(calls).toEqual([]);
  });
  it("records only one confirmed draft through its retry-safe transaction", async () => {
    getAdminClient.mockReturnValue(admin({}));
    rpc.mockResolvedValue({
      data: { markedCount: 1, skippedCount: 0, sentAt: "2026-10-21T12:00:00Z" },
      error: null,
    });
    const { POST } = await import("@/app/api/ryd/reminders/route");
    const response = await POST(
      new Request(
        "http://localhost/api/ryd/reminders",
        json(
          {
            operationId: "40000000-0000-4000-8000-000000000401",
            targets: [{ orderId: "1001", email: "Ryan@example.com" }],
          },
          "POST",
        ),
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ markedCount: 1 });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("ryd_record_reminders", {
      requested_actor: "member-1",
      requested_operation: "40000000-0000-4000-8000-000000000401",
      requested_targets: [{ orderId: "1001", email: "ryan@example.com" }],
    });
  });

  it("refuses to change the decision on an order in production", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "RY409",
        message:
          "This order is already with fulfillment or in production. Its decision cannot be changed.",
      },
    });
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

  it("dispatches production changes through one atomic RPC", async () => {
    rpc.mockResolvedValue({ data: { movedCount: 1 }, error: null });
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
        json(
          {
            operationId: "00000000-0000-4000-8000-000000000601",
            moves: [{ orderId: "1001", from: "not-started", to: "done" }],
          },
          "POST",
        ),
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ movedCount: 1 });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("ryd_move_production", {
      requested_actor: "member-1",
      requested_operation: "00000000-0000-4000-8000-000000000601",
      requested_moves: [{ orderId: "1001", from: "not-started", to: "done" }],
    });
    expect(calls).toEqual([]);
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
    rpc.mockResolvedValue({ data: { markedCount: 2 }, error: null });
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
          {
            operationId: "00000000-0000-4000-8000-000000000601",
            emails: ["Ryan@Example.com ", "ryan@example.com", "b@x.dev"],
          },
          "POST",
        ),
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.markedCount).toBe(2);
    expect(calls).toEqual([]);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("ryd_record_contacts", {
      requested_actor: "member-1",
      requested_operation: "00000000-0000-4000-8000-000000000601",
      requested_emails: ["ryan@example.com", "b@x.dev"],
    });
  });

  it("says a pending migration blocks contact confirmations before the RPC exists", async () => {
    getAdminClient.mockReturnValue(admin({}));
    rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "missing" },
    });
    const { POST } = await import("@/app/api/ryd/submitter-contacts/route");
    const response = await POST(
      new Request(
        "http://localhost/api/ryd/submitter-contacts",
        json(
          {
            operationId: "00000000-0000-4000-8000-000000000601",
            emails: ["ryan@example.com"],
          },
          "POST",
        ),
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

  it("generates an email and CSV without saving or confirming a batch", async () => {
    getAdminClient.mockReturnValue(admin({}));
    rpc.mockResolvedValue({ data: {
      recipient: "toney@example.test", generated_at: "2026-10-23T12:00:00Z", headers: ["OrderId", "Verified?"],
      order_rows: [{ order_id: "1001", raw: { OrderId: "1001" }, status: "verified", first_name: "Ryan", last_name: "Example" }],
    }, error: null });
    const { POST } = await import("@/app/api/ryd/batches/route");
    const send = (body: unknown) => POST(new Request("http://localhost/api/ryd/batches", json(body, "POST")));
    const response = await send({ orderIds: ["1001", "1001"] });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ orderCount: 1, recipient: "toney@example.test", csv: expect.stringContaining("1001,✅") });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("ryd_generate_fulfillment", { requested_actor: "member-1", requested_orders: ["1001"] });
    for (const body of [{ action: "prepare" }, { action: "confirm", snapshotId: "00000000-0000-4000-8000-000000000301" }, { orderIds: [] }, { orderIds: ["1001"], replaceSnapshotId: "old" }]) expect((await send(body)).status).toBe(400);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("accepts a large selection without truncation and keeps a bounded request", async () => {
    getAdminClient.mockReturnValue(admin({}));
    rpc.mockResolvedValue({ data: { recipient: "toney@example.test", generated_at: "2026-10-23T12:00:00Z", headers: [], order_rows: [] }, error: null });
    const { POST } = await import("@/app/api/ryd/batches/route");
    const send = (body: unknown) => POST(new Request("http://localhost/api/ryd/batches", json(body, "POST")));
    const orderIds = Array.from({ length: 5000 }, (_, i) => `selected-order-${i}`);
    expect((await send({ orderIds })).status).toBe(200);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("ryd_generate_fulfillment", { requested_actor: "member-1", requested_orders: orderIds });
    expect((await send({ orderIds: [...orderIds, "too-many"] })).status).toBe(400);
    expect((await send({ orderIds: ["x".repeat(512 * 1024)] })).status).toBe(413);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("refuses downloads without a manifest and never exports a live queue", async () => {
    getAdminClient.mockReturnValue(admin({}));
    const { GET } = await import("@/app/api/ryd/export/route");
    expect(
      (await GET(new Request("http://localhost/api/ryd/export"))).status,
    ).toBe(400);
    expect(
      (await GET(new Request("http://localhost/api/ryd/export?batch=bad")))
        .status,
    ).toBe(400);
    getAdminClient.mockReturnValue(
      admin({
        ryd_fulfillment_snapshots: table({
          data: { state: "cancelled" },
          error: null,
        }),
      }),
    );
    expect(
      (
        await GET(
          new Request(
            "http://localhost/api/ryd/export?batch=00000000-0000-4000-8000-000000000301",
          ),
        )
      ).status,
    ).toBe(409);
  });
});
