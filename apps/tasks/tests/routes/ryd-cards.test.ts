import { beforeEach, describe, expect, it, vi } from "vitest";

const authorize = vi.fn();
const getInstanceSettings = vi.fn();
const getAdminClient = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/auth", () => ({ authorize }));
vi.mock("@/lib/server/instance-settings", () => ({ getInstanceSettings }));
vi.mock("@/lib/server/admin-client", () => ({ getAdminClient }));

const member = { user: { id: "partner-1" }, supabase: { rpc: vi.fn() } };
const BATCH = "40000000-0000-4000-8000-000000000001";
const OPERATION = "50000000-0000-4000-8000-000000000001";

/** Answers every query chain with the result for its table. */
function admin(results: Record<string, unknown>, rpc = vi.fn()) {
  return {
    rpc,
    from: (name: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "range", "limit"])
        builder[method] = () => builder;
      builder.maybeSingle = () => Promise.resolve(results[name]);
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(results[name]).then(resolve);
      return builder;
    },
  };
}

const post = (body: unknown) =>
  new Request("http://localhost/api/ryd/cards", {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("RY-D card batches", () => {
  beforeEach(() => {
    vi.resetModules();
    authorize.mockReset().mockResolvedValue(member);
    getInstanceSettings.mockReset().mockResolvedValue({ rydEnabled: true });
    getAdminClient.mockReset();
  });

  it("pulls a batch with the queue's page access, not RY-D Settings", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { batchId: BATCH, orderCount: 2 },
      error: null,
    });
    getAdminClient.mockReturnValue(admin({}, rpc));
    const { POST } = await import("@/app/api/ryd/cards/route");

    const response = await POST(post({ operationId: OPERATION }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ batchId: BATCH, orderCount: 2 });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("ryd_create_card_batch", {
      requested_actor: "partner-1",
      requested_operation: OPERATION,
    });
    expect(authorize).toHaveBeenCalledWith({ onboarded: true, area: "ryd" });
    expect(member.supabase.rpc).not.toHaveBeenCalled();
  });

  it("refuses a pull without an operation", async () => {
    getAdminClient.mockReturnValue(admin({}));
    const { POST } = await import("@/app/api/ryd/cards/route");
    expect((await POST(post({}))).status).toBe(400);
  });

  it("downloads a batch from its frozen rows as UTF-8 with a dated name", async () => {
    getAdminClient.mockReturnValue(
      admin({
        ryd_card_batches: {
          data: { created_at: "2026-10-27T15:00:00Z" },
          error: null,
        },
        ryd_card_batch_orders: {
          data: [
            {
              order_id: "607227",
              first_name: "Ryan",
              last_name: "Pérez",
              location: "Cleveland Ohio",
              ryan_since: "1976",
            },
          ],
          error: null,
        },
      }),
    );
    const { GET } = await import("@/app/api/ryd/cards/[batchId]/route");

    const response = await GET(
      new Request(`http://localhost/api/ryd/cards/${BATCH}`),
      { params: Promise.resolve({ batchId: BATCH }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="ry-d-cards-2026-10-27.csv"',
    );
    const body = new Uint8Array(await response.arrayBuffer());
    expect([...body.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(body)).toBe(
      "Order Number,Name,Location,Ryan Since\r\n607227,Ryan Pérez,Cleveland Ohio,1976\r\n",
    );
  });

  it("answers an unknown batch as missing", async () => {
    getAdminClient.mockReturnValue(
      admin({ ryd_card_batches: { data: null, error: null } }),
    );
    const { GET } = await import("@/app/api/ryd/cards/[batchId]/route");
    const response = await GET(
      new Request(`http://localhost/api/ryd/cards/${BATCH}`),
      { params: Promise.resolve({ batchId: BATCH }) },
    );
    expect(response.status).toBe(404);
  });
});
