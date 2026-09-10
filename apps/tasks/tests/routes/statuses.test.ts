import { beforeEach, describe, expect, it, vi } from "vitest";

const privilegedContext = vi.fn();
const auditPrivilegedAction = vi.fn();
const recordWorkspaceActivity = vi.fn();
vi.mock("@/lib/server/privileged-api", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/server/privileged-api")
  >()),
  privilegedContext,
  auditPrivilegedAction,
  recordWorkspaceActivity,
}));

const statusId = "11111111-1111-4111-8111-111111111111";
const secondStatusId = "22222222-2222-4222-8222-222222222222";
const user = { id: "33333333-3333-4333-8333-333333333333" };

function request(method: string, body: unknown) {
  return new Request("http://localhost/api/statuses", {
    method,
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });
}

function single(result: Record<string, unknown>) {
  return { single: vi.fn().mockResolvedValue(result) };
}

function updateQuery(result: Record<string, unknown>) {
  const builder: Record<string, unknown> = {};
  for (const method of ["update", "eq", "select"])
    builder[method] = vi.fn(() => builder);
  builder.single = vi.fn().mockResolvedValue(result);
  return builder;
}

describe("status route contracts", () => {
  beforeEach(() => {
    privilegedContext.mockReset();
    auditPrivilegedAction.mockReset();
    recordWorkspaceActivity.mockReset();
    auditPrivilegedAction.mockResolvedValue(true);
    recordWorkspaceActivity.mockResolvedValue(true);
    process.env.TASKS_APP_URL = "http://localhost";
  });

  it("rejects invalid status input before requesting privileged access", async () => {
    const { POST } = await import("@/app/api/statuses/route");

    const response = await POST(request("POST", { name: "Missing color" }));

    expect(response.status).toBe(400);
    expect(privilegedContext).not.toHaveBeenCalled();
  });

  it("creates and records a workspace-wide status", async () => {
    const status = { id: statusId, name: "Ready", color: "#123abc" };
    const admin = {
      rpc: vi.fn().mockReturnValue(single({ data: status, error: null })),
    };
    privilegedContext.mockResolvedValue({ user, admin, supabase: {} });
    const { POST } = await import("@/app/api/statuses/route");

    const response = await POST(
      request("POST", {
        name: "  Ready  ",
        description: "  Ready to begin  ",
        color: "#123abc",
      }),
    );

    expect(response.status).toBe(200);
    expect(admin.rpc).toHaveBeenCalledWith("create_status", {
      status_name: "Ready",
      status_description: "Ready to begin",
      status_color: "#123abc",
    });
    expect(auditPrivilegedAction).toHaveBeenCalledWith(
      admin,
      user,
      expect.objectContaining({ action: "status.create", targetId: statusId }),
    );
    expect(recordWorkspaceActivity).toHaveBeenCalledWith(
      admin,
      user,
      expect.objectContaining({ action: "status.create" }),
    );
  });

  it("reports an audit failure after a status was created", async () => {
    const status = { id: statusId, name: "Ready" };
    const admin = {
      rpc: vi.fn().mockReturnValue(single({ data: status, error: null })),
    };
    privilegedContext.mockResolvedValue({ user, admin, supabase: {} });
    auditPrivilegedAction.mockResolvedValue(false);
    const { POST } = await import("@/app/api/statuses/route");

    const response = await POST(
      request("POST", { name: "Ready", description: "", color: "#123abc" }),
    );

    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe("AUDIT_FAILED");
    expect(recordWorkspaceActivity).not.toHaveBeenCalled();
  });

  it("rejects duplicate IDs before reordering statuses", async () => {
    const admin = { rpc: vi.fn() };
    privilegedContext.mockResolvedValue({ user, admin, supabase: {} });
    const { PATCH } = await import("@/app/api/statuses/route");

    const response = await PATCH(
      request("PATCH", {
        orderedIds: [statusId, statusId],
        expectedRevision: 4,
      }),
    );

    expect(response.status).toBe(400);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("maps a stale reorder revision to a conflict", async () => {
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const admin = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "40001", message: "revision mismatch" },
      }),
    };
    privilegedContext.mockResolvedValue({ user, admin, supabase: {} });
    const { PATCH } = await import("@/app/api/statuses/route");

    const response = await PATCH(
      request("PATCH", {
        orderedIds: [statusId, secondStatusId],
        expectedRevision: 4,
      }),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("changed");
    expect(auditPrivilegedAction).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it("maps editable fields to the database status row", async () => {
    const status = {
      id: statusId,
      name: "Complete",
      outcome: "delivered",
      requires_reason: false,
    };
    const builder = updateQuery({ data: status, error: null });
    const admin = { from: vi.fn(() => builder) };
    privilegedContext.mockResolvedValue({ user, admin, supabase: {} });
    const { PATCH } = await import("@/app/api/statuses/route");

    const response = await PATCH(
      request("PATCH", {
        id: statusId,
        name: "Complete",
        outcome: "delivered",
        requiresReason: false,
      }),
    );

    expect(response.status).toBe(200);
    expect(builder.update).toHaveBeenCalledWith({
      name: "Complete",
      outcome: "delivered",
      requires_reason: false,
    });
    expect(recordWorkspaceActivity).toHaveBeenCalledWith(
      admin,
      user,
      expect.objectContaining({
        action: "status.update",
        metadata: { resource_name: "Complete" },
      }),
    );
  });

  it("fails safely when delete_status returns no row", async () => {
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const admin = {
      rpc: vi.fn().mockReturnValue(single({ data: null, error: null })),
    };
    privilegedContext.mockResolvedValue({ user, admin, supabase: {} });
    const { DELETE } = await import("@/app/api/statuses/route");

    const response = await DELETE(request("DELETE", { id: statusId }));

    expect(response.status).toBe(500);
    expect((await response.json()).error).not.toContain("RPC");
    expect(auditPrivilegedAction).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it("deletes and records the status name", async () => {
    const deleted = { id: statusId, name: "Old status" };
    const admin = {
      rpc: vi.fn().mockReturnValue(single({ data: deleted, error: null })),
    };
    privilegedContext.mockResolvedValue({ user, admin, supabase: {} });
    const { DELETE } = await import("@/app/api/statuses/route");

    const response = await DELETE(request("DELETE", { id: statusId }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: statusId });
    expect(recordWorkspaceActivity).toHaveBeenCalledWith(admin, user, {
      action: "status.delete",
      targetType: "status",
      targetId: statusId,
      metadata: { resource_name: "Old status" },
    });
  });
});
