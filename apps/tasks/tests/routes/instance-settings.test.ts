import { beforeEach, describe, expect, it, vi } from "vitest";

const privilegedContext = vi.fn();
const auditPrivilegedAction = vi.fn();
const recordWorkspaceActivity = vi.fn();
vi.mock("@/lib/server/privileged-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/privileged-api")>()),
  privilegedContext,
  auditPrivilegedAction,
  recordWorkspaceActivity,
}));

const user = { id: "33333333-3333-4333-8333-333333333333" };

function request(body: unknown) {
  return new Request("http://localhost/api/instance-settings", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });
}

function database(health: { data: unknown; error: unknown }) {
  const upsert = vi.fn(() => ({
    select: () => ({
      single: vi.fn().mockResolvedValue({
        data: { ryd_enabled: true },
        error: null,
      }),
    }),
  }));
  return {
    upsert,
    admin: {
      rpc: vi.fn().mockResolvedValue(health),
      from: vi.fn(() => ({ upsert })),
    },
  };
}

describe("instance settings route", () => {
  beforeEach(() => {
    privilegedContext.mockReset();
    auditPrivilegedAction.mockReset().mockResolvedValue(true);
    recordWorkspaceActivity.mockReset().mockResolvedValue(true);
    process.env.TASKS_APP_URL = "http://localhost";
  });

  it("turns RY-D on when the database passes its contract", async () => {
    const { admin, upsert } = database({
      data: { contractOk: true, failures: [] },
      error: null,
    });
    privilegedContext.mockResolvedValue({ user, admin, supabase: {} });
    const { PATCH } = await import("@/app/api/instance-settings/route");

    const response = await PATCH(request({ rydEnabled: true }));

    expect(response.status).toBe(200);
    expect(admin.rpc).toHaveBeenCalledWith("ryd_contract_health");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ ryd_enabled: true }),
    );
  });

  it.each([
    [
      "fails its contract",
      {
        data: {
          contractOk: false,
          failures: ["Missing table: ryd_card_batches"],
        },
        error: null,
      },
    ],
    ["has no contract check", { data: null, error: { code: "PGRST202" } }],
  ])("refuses to turn RY-D on when the database %s", async (_, health) => {
    const { admin, upsert } = database(health);
    privilegedContext.mockResolvedValue({ user, admin, supabase: {} });
    const { PATCH } = await import("@/app/api/instance-settings/route");

    const response = await PATCH(request({ rydEnabled: true }));

    expect(response.status).toBe(409);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("turns RY-D off without checking the contract", async () => {
    const { admin, upsert } = database({ data: null, error: null });
    privilegedContext.mockResolvedValue({ user, admin, supabase: {} });
    const { PATCH } = await import("@/app/api/instance-settings/route");

    const response = await PATCH(request({ rydEnabled: false }));

    expect(response.status).toBe(200);
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalled();
  });
});
