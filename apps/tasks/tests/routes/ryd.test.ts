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

  it("asks for the RY-D page, and owner rights only for settings", async () => {
    authorize.mockResolvedValue({
      response: Response.json({}, { status: 403 }),
    });
    const queue = await import("@/app/api/ryd/route");
    const settings = await import("@/app/api/ryd/settings/route");

    expect((await queue.GET()).status).toBe(403);
    expect(authorize).toHaveBeenLastCalledWith({
      onboarded: true,
      area: "ryd",
      owner: false,
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
      owner: true,
    });
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
          data: { form_sheet_id: "s".repeat(30), fulfillment_email: null },
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
});
