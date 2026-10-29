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

const groupId = "11111111-1111-4111-8111-111111111111";
const user = { id: "22222222-2222-4222-8222-222222222222" };

function request(body: unknown) {
  return new Request("http://localhost/api/workspace-area-access", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });
}

describe("page access route contract", () => {
  beforeEach(() => {
    privilegedContext.mockReset();
    auditPrivilegedAction.mockReset();
    recordWorkspaceActivity.mockReset();
    auditPrivilegedAction.mockResolvedValue(true);
    recordWorkspaceActivity.mockResolvedValue(true);
    process.env.TASKS_APP_URL = "http://localhost";
  });

  it("rejects a page the registry does not declare, before asking for access", async () => {
    const { POST } = await import("@/app/api/workspace-area-access/route");

    const response = await POST(
      request({ area: "board", accessMode: "restricted", groupIds: [groupId] }),
    );

    expect(response.status).toBe(400);
    expect(privilegedContext).not.toHaveBeenCalled();
  });

  it("rejects RY-D Settings, whose access is a fixed rule", async () => {
    const { POST } = await import("@/app/api/workspace-area-access/route");

    const response = await POST(
      request({
        area: "ryd-settings",
        accessMode: "restricted",
        groupIds: [groupId],
      }),
    );

    expect(response.status).toBe(400);
    expect(privilegedContext).not.toHaveBeenCalled();
  });

  it("rejects an unknown access mode", async () => {
    const { POST } = await import("@/app/api/workspace-area-access/route");

    const response = await POST(
      request({ area: "notes", accessMode: "owners", groupIds: [] }),
    );

    expect(response.status).toBe(400);
    expect(privilegedContext).not.toHaveBeenCalled();
  });

  it("replaces the mode and the complete group set in one call", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ error: null }) };
    privilegedContext.mockResolvedValue({ user, admin: {}, supabase });
    const { POST } = await import("@/app/api/workspace-area-access/route");

    const response = await POST(
      request({
        area: "contacts",
        accessMode: "restricted",
        groupIds: [groupId, groupId],
      }),
    );

    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("set_workspace_area_access", {
      requested_area: "contacts",
      requested_access_mode: "restricted",
      requested_group_ids: [groupId],
    });
    expect(auditPrivilegedAction).toHaveBeenCalledWith(
      {},
      user,
      expect.objectContaining({ action: "workspace_area.access.update" }),
    );
  });

  it("drops selected groups when the page is opened again", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ error: null }) };
    privilegedContext.mockResolvedValue({ user, admin: {}, supabase });
    const { POST } = await import("@/app/api/workspace-area-access/route");

    await POST(
      request({ area: "notes", accessMode: "open", groupIds: [groupId] }),
    );

    expect(supabase.rpc).toHaveBeenCalledWith("set_workspace_area_access", {
      requested_area: "notes",
      requested_access_mode: "open",
      requested_group_ids: [],
    });
  });

  it("refuses to report success when the audit record fails", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ error: null }) };
    privilegedContext.mockResolvedValue({ user, admin: {}, supabase });
    auditPrivilegedAction.mockResolvedValue(false);
    const { POST } = await import("@/app/api/workspace-area-access/route");

    const response = await POST(
      request({ area: "calendar", accessMode: "restricted", groupIds: [] }),
    );

    expect(response.status).toBe(500);
  });
});
