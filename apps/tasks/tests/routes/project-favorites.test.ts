import { beforeEach, describe, expect, it, vi } from "vitest";

const privilegedContext = vi.fn();

vi.mock("@/lib/server/privileged-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/privileged-api")>()),
  privilegedContext,
}));

const projectId = "11111111-1111-4111-8111-111111111111";
const user = { id: "22222222-2222-4222-8222-222222222222" };

function request(favorite: boolean) {
  return new Request("http://localhost/api/profile/favorite-projects", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify({ projectId, favorite }),
  });
}

function projectQuery(status: "active" | "complete") {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is"])
    builder[method] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn().mockResolvedValue({
    data: { id: projectId, status },
    error: null,
  });
  return builder;
}

describe("project favorite route", () => {
  beforeEach(() => {
    privilegedContext.mockReset();
    process.env.TASKS_APP_URL = "http://localhost";
  });

  it("does not add a completed project to favorites", async () => {
    const admin = { from: vi.fn() };
    const supabase = {
      from: vi.fn().mockReturnValue(projectQuery("complete")),
    };
    privilegedContext.mockResolvedValue({ user, admin, supabase });
    const { PATCH } = await import("@/app/api/profile/favorite-projects/route");

    const response = await PATCH(request(true));

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe(
      "Completed projects cannot be added to favorites.",
    );
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("still lets a stale completed favorite be removed", async () => {
    const profileRead = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { favorite_project_ids: [projectId] },
        error: null,
      }),
    };
    const updateResult = { error: null };
    const profileUpdate: Record<string, unknown> = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue(updateResult),
    };
    const admin = {
      from: vi
        .fn()
        .mockReturnValueOnce(profileRead)
        .mockReturnValueOnce(profileUpdate),
    };
    const supabase = {
      from: vi.fn().mockReturnValue(projectQuery("complete")),
    };
    privilegedContext.mockResolvedValue({ user, admin, supabase });
    const { PATCH } = await import("@/app/api/profile/favorite-projects/route");

    const response = await PATCH(request(false));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ favoriteProjectIds: [] });
    expect(profileUpdate.update).toHaveBeenCalledWith({
      favorite_project_ids: [],
    });
  });
});
