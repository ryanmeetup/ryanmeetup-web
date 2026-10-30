import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RydBulkDecision } from "@/lib/ryd/bulk-operations";

const mocks = vi.hoisted(() => ({ context: vi.fn(), read: vi.fn(), settings: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/server/ryd", () => ({ rydContext: mocks.context, loadRydSettings: mocks.settings }));
vi.mock("@/lib/server/ryd-google", () => ({
  loadRydGoogleIntegration: async () => ({ account_email: "synthetic@example.test" }),
  readRydSubmissions: mocks.read,
}));

const card = { firstName: "Ryan", lastName: "Example", location: "Brooklyn", ryanSince: "1999" };
const decisions = (count: number): RydBulkDecision[] => Array.from({ length: count }, (_, i) => ({
  orderId: String(i), status: "verified", expectedStatus: "pending", card,
  submissionKeys: [`response-${i}`], expectedUpdatedAt: "2026-10-20T12:00:00Z",
}));
const post = async (body: unknown) => {
  const { POST } = await import("@/app/api/ryd/decisions/route");
  return POST(new Request("http://localhost/api/ryd/decisions", {
    method: "POST", headers: { origin: "http://localhost", "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
};

describe("RY-D bulk review boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.context.mockResolvedValue({ user: { id: "operator" }, admin: { rpc: mocks.rpc } });
    mocks.settings.mockResolvedValue({ formId: "configured-form" });
    mocks.read.mockResolvedValue({ submissions: decisions(77).map((_, i) => ({ key: `response-${i}` })) });
    mocks.rpc.mockResolvedValue({ data: { reviews: [], failures: [] }, error: null });
  });

  it("reads Google once and invokes one transaction for 77 suggested orders", async () => {
    const input = decisions(77);
    const response = await post({ decisions: input });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.read).toHaveBeenCalledExactlyOnceWith(expect.anything(), "configured-form", { fresh: true });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("ryd_review_orders", {
      requested_actor: "operator", requested_decisions: input,
      requested_form: "configured-form", requested_known_keys: input.map((decision) => decision.submissionKeys![0]),
    });
  });

  it("deduplicates provenance and leaves missing responses for individual refusals", async () => {
    const input = decisions(2);
    input[1].submissionKeys = ["response-0", "removed-response"];
    mocks.read.mockResolvedValue({ submissions: [{ key: "response-0" }] });
    mocks.rpc.mockResolvedValue({ data: { reviews: [], failures: [{ orderId: "1", message: "Response removed" }] }, error: null });
    const response = await post({ decisions: input });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ failures: [{ orderId: "1" }] });
    expect(mocks.read).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("ryd_review_orders", expect.objectContaining({
      requested_decisions: input, requested_known_keys: ["response-0"],
    }));
  });

  it("does not read Google when no new evidence is accepted", async () => {
    expect((await post({ decisions: [{ orderId: "1", status: "needs_info", expectedStatus: "pending" }] })).status).toBe(200);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.settings).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("ryd_review_orders", expect.objectContaining({ requested_form: null, requested_known_keys: [] }));
  });

  it("does not write decisions when Google provenance is unavailable", async () => {
    mocks.read.mockRejectedValueOnce(new Error("Synthetic Google outage"));
    expect((await post({ decisions: decisions(2) })).status).toBe(500);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("explains a pending migration without falling back to serial writes", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    expect((await post({ decisions: decisions(2) })).status).toBe(503);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    { decisions: [] },
    { decisions: decisions(101) },
    { decisions: [decisions(1)[0], decisions(1)[0]] },
    { decisions: [{ orderId: "1", status: "verified", expectedStatus: "pending" }] },
    { decisions: [{ orderId: "1", status: "needs_info", expectedStatus: "pending", note: "extra" }] },
    { decisions: [{ orderId: "1", status: "verified", expectedStatus: "pending", card, submissionKeys: ["x"] }] },
    { decisions: decisions(1), extra: true },
  ])("rejects an invalid group without Google or database work (%#)", async (input) => {
    expect((await post(input)).status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("enforces the bounded body before parsing", async () => {
    expect((await post({ decisions: ["x".repeat(512 * 1024)] })).status).toBe(413);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
