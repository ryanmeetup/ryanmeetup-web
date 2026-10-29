import { beforeEach, describe, expect, it, vi } from "vitest";

const privilegedContext = vi.fn();
const auditPrivilegedAction = vi.fn();
const recordWorkspaceActivity = vi.fn();
const consumeInviteLimit = vi.fn();
vi.mock("@/lib/server/privileged-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/privileged-api")>()),
  privilegedContext,
  auditPrivilegedAction,
  recordWorkspaceActivity,
  consumeInviteLimit,
}));

const owner = { id: "22222222-2222-4222-8222-222222222222" };
const invitee = { id: "33333333-3333-4333-8333-333333333333" };
const guestTier = "44444444-4444-4444-8444-444444444444";
const rydTeam = "55555555-5555-4555-8555-555555555555";

function request(body: unknown) {
  return new Request("http://localhost/api/team", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });
}

function context(rpcResult: { data?: unknown; error?: unknown }) {
  const admin = {
    auth: {
      admin: {
        inviteUserByEmail: vi
          .fn()
          .mockResolvedValue({ data: { user: invitee }, error: null }),
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  };
  const supabase = {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null, ...rpcResult }),
  };
  privilegedContext.mockResolvedValue({ user: owner, admin, supabase });
  return { admin, supabase };
}

const access = { tierId: guestTier, teamIds: [rydTeam], appRole: "member" };

describe("team invite route contract", () => {
  beforeEach(() => {
    privilegedContext.mockReset();
    auditPrivilegedAction.mockReset().mockResolvedValue(true);
    recordWorkspaceActivity.mockReset().mockResolvedValue(true);
    consumeInviteLimit.mockReset().mockResolvedValue(true);
    process.env.TASKS_APP_URL = "http://localhost";
  });

  it("sets the invitee's tier and teams before they can accept", async () => {
    const members = [
      { group_id: guestTier, profile_id: invitee.id },
      { group_id: rydTeam, profile_id: invitee.id },
    ];
    const { supabase } = context({
      data: { profile: { app_role: "member" }, members },
    });
    const { POST } = await import("@/app/api/team/route");

    const response = await POST(
      request({ email: "Partner@Example.com", fullName: "P&M", access }),
    );

    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("replace_profile_access", {
      requested_profile_id: invitee.id,
      requested_tier_id: guestTier,
      requested_team_ids: [rydTeam],
      requested_app_role: "member",
    });
    expect(await response.json()).toMatchObject({
      profile: { id: invitee.id, app_role: "member" },
      members,
    });
  });

  it("withdraws the invitation when its access cannot be saved", async () => {
    const { admin } = context({
      error: { code: "RS001", message: "A selected team is not available" },
    });
    const { POST } = await import("@/app/api/team/route");

    const response = await POST(
      request({ email: "partner@example.com", access }),
    );

    expect(response.ok).toBe(false);
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(invitee.id);
    expect(recordWorkspaceActivity).not.toHaveBeenCalled();
  });

  it("leaves an invite without access in the default tier", async () => {
    const { supabase } = context({});
    const { POST } = await import("@/app/api/team/route");

    const response = await POST(request({ email: "ryan@example.com" }));

    expect(response.status).toBe(200);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("rejects access without a tier", async () => {
    const { POST } = await import("@/app/api/team/route");

    const response = await POST(
      request({
        email: "partner@example.com",
        access: { teamIds: [rydTeam], appRole: "member" },
      }),
    );

    expect(response.status).toBe(400);
    expect(privilegedContext).not.toHaveBeenCalled();
  });
});
