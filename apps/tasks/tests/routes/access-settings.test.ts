import { beforeEach, describe, expect, it, vi } from "vitest";

const privilegedContext = vi.fn();
const recordWorkspaceActivity = vi.fn();
vi.mock("@/lib/server/privileged-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/privileged-api")>()),
  privilegedContext,
  recordWorkspaceActivity,
}));

const projectId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
const groupId = "33333333-3333-4333-8333-333333333333";

function query(result: Record<string, unknown>) {
  const builder: Record<string, unknown> = {
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  for (const method of ["select", "eq", "order"])
    builder[method] = vi.fn(() => builder);
  builder.single = vi.fn().mockResolvedValue(result);
  return builder;
}

describe("access settings read contracts", () => {
  beforeEach(() => {
    privilegedContext.mockReset();
    recordWorkspaceActivity.mockReset();
  });

  it("uses the narrow project access-administrator predicate", async () => {
    const groups = query({
      data: [
        {
          id: groupId,
          name: "Leadership",
          kind: "tier",
          hierarchy_rank: 100,
          grants_global_content: true,
        },
      ],
      error: null,
    });
    const grants = query({ data: [{ group_id: groupId }], error: null });
    const project = query({ data: { access_mode: "restricted" }, error: null });
    const from = vi.fn((table: string) => {
      if (table === "access_groups") return groups;
      if (table === "project_group_grants") return grants;
      return project;
    });
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    privilegedContext.mockResolvedValue({
      user: { id: "owner" },
      supabase: { rpc },
      admin: { from },
    });
    const { GET } = await import("@/app/api/project-access/route");

    const response = await GET(
      new Request(`http://localhost/api/project-access?projectId=${projectId}`),
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("can_administer_project_access", {
      requested_project_id: projectId,
    });
    expect(groups.eq).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      groupIds: [groupId],
      groups: [{ id: groupId, grants_global_content: true }],
    });
  });

  it("does not write activity when project access is unchanged", async () => {
    const project = query({ data: { access_mode: "restricted" }, error: null });
    const grants = query({ data: [{ group_id: groupId }], error: null });
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    privilegedContext.mockResolvedValue({
      user: { id: "owner" },
      supabase: { rpc },
      admin: {
        from: vi.fn((table: string) =>
          table === "projects" ? project : grants,
        ),
      },
    });
    const { POST } = await import("@/app/api/project-access/route");

    const response = await POST(
      new Request("http://localhost/api/project-access", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          accessMode: "restricted",
          groupIds: [groupId],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalledWith(
      "set_project_visibility",
      expect.anything(),
    );
    expect(recordWorkspaceActivity).not.toHaveBeenCalled();
  });

  it("keeps workspace-wide tiers in the category picker", async () => {
    const groups = query({
      data: [
        {
          id: groupId,
          name: "Leadership",
          kind: "tier",
          hierarchy_rank: 100,
          grants_global_content: true,
        },
      ],
      error: null,
    });
    const grants = query({ data: [{ group_id: groupId }], error: null });
    const from = vi.fn((table: string) =>
      table === "access_groups" ? groups : grants,
    );
    privilegedContext.mockResolvedValue({
      user: { id: "owner" },
      supabase: {},
      admin: { from },
    });
    const { GET } = await import("@/app/api/category-access/route");

    const response = await GET(
      new Request(
        `http://localhost/api/category-access?categoryId=${categoryId}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(privilegedContext).toHaveBeenCalledWith({ owner: true });
    expect(groups.eq).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      groupIds: [groupId],
      groups: [{ id: groupId, grants_global_content: true }],
    });
  });
});
