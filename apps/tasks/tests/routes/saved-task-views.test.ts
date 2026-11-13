import { beforeEach, describe, expect, it, vi } from "vitest";

const authorize = vi.fn();
vi.mock("@/lib/server/auth", () => ({ authorize }));

const viewId = "11111111-1111-4111-8111-111111111111";
const profileId = "22222222-2222-4222-8222-222222222222";
const filters = {
  statuses: [],
  excludedStatuses: [],
  projects: [],
  excludedProjects: [],
  assignees: [],
  excludedAssignees: [],
  reporters: [],
  excludedReporters: [],
  categories: [],
  excludedCategories: [],
  priorities: [],
  excludedPriorities: [],
  dueWithin: [],
  excludedDueWithin: [],
  tags: [],
  excludedTags: [],
};
const settings = {
  version: 1,
  filters,
  view: "board",
  sort: "updated",
  visibility: "active",
};

function request(method: string, body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/saved-task-views", {
    method,
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function database(
  result: { data: unknown; error: unknown } = {
    data: { id: viewId, name: "Focus", settings },
    error: null,
  },
) {
  const chain = {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  for (const key of ["insert", "update", "delete", "eq", "select"] as const)
    chain[key].mockReturnValue(chain);
  const from = vi.fn().mockReturnValue(chain);
  authorize.mockResolvedValue({ user: { id: profileId }, supabase: { from } });
  return { from, ...chain };
}

describe("saved view routes", () => {
  beforeEach(() => {
    authorize.mockReset();
    process.env.TASKS_APP_URL = "http://localhost";
  });

  it("authenticates before attempting any write", async () => {
    authorize.mockResolvedValue({
      response: new Response(null, { status: 401 }),
    });
    const { POST } = await import("@/app/api/saved-task-views/route");
    expect((await POST(request("POST", {}))).status).toBe(401);
    expect(authorize).toHaveBeenCalledWith({ onboarded: true });
  });

  it("takes ownership only from the signed-in user and returns the canonical row", async () => {
    const db = database();
    const { POST } = await import("@/app/api/saved-task-views/route");
    const response = await POST(request("POST", { name: " Focus ", settings }));
    expect(response.status).toBe(201);
    expect(db.insert).toHaveBeenCalledWith({
      profile_id: profileId,
      name: "Focus",
      settings,
    });
    expect(await response.json()).toMatchObject({
      view: { id: viewId, name: "Focus" },
    });
  });

  it("rejects cross-origin writes and caller-supplied ownership", async () => {
    const db = database();
    const { POST } = await import("@/app/api/saved-task-views/route");
    expect(
      (
        await POST(
          request(
            "POST",
            { name: "Focus", settings },
            "https://elsewhere.test",
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await POST(
          request("POST", { name: "Focus", settings, profile_id: "other" }),
        )
      ).status,
    ).toBe(400);
    expect(db.from).not.toHaveBeenCalled();
  });

  it("scopes updates to the current owner and can rename without changing filters", async () => {
    const db = database();
    const { PATCH } = await import("@/app/api/saved-task-views/[id]/route");
    expect(
      (
        await PATCH(request("PATCH", { name: "Renamed" }), {
          params: Promise.resolve({ id: viewId }),
        })
      ).status,
    ).toBe(200);
    expect(db.update).toHaveBeenCalledWith({ name: "Renamed" });
    expect(db.eq).toHaveBeenCalledWith("profile_id", profileId);
    expect(db.eq).toHaveBeenCalledWith("id", viewId);
  });

  it("returns 404 for another user's row instead of updating or deleting it", async () => {
    const db = database({ data: null, error: null });
    const { PATCH, DELETE } =
      await import("@/app/api/saved-task-views/[id]/route");
    const context = { params: Promise.resolve({ id: viewId }) };
    expect(
      (await PATCH(request("PATCH", { name: "Changed" }), context)).status,
    ).toBe(404);
    expect((await DELETE(request("DELETE", {}), context)).status).toBe(404);
    expect(db.eq).toHaveBeenCalledWith("profile_id", profileId);
  });

  it("reports duplicate names as a conflict without returning raw database details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    database({
      data: null,
      error: { code: "23505", message: "private database details" },
    });
    const { POST } = await import("@/app/api/saved-task-views/route");
    const response = await POST(request("POST", { name: "Focus", settings }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "CONFLICT",
      error: "You already have a view with that name. Choose another name.",
    });
    log.mockRestore();
  });
});
