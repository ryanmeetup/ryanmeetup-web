import { beforeEach, describe, expect, it, vi } from "vitest";

const authorize = vi.fn();
vi.mock("@/lib/server/auth", () => ({ authorize }));

const categoryId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const ownerId = "33333333-3333-4333-8333-333333333333";

function request(method: string, body: unknown) {
  return new Request("http://localhost/api/resource", {
    method,
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });
}

function query(result: Record<string, unknown>) {
  const builder: Record<string, unknown> = {
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  for (const method of ["select", "eq", "delete"])
    builder[method] = vi.fn(() => builder);
  builder.single = vi.fn().mockResolvedValue(result);
  return builder;
}

const categoryCreate = {
  name: "  Operations  ",
  description: "  Event operations  ",
  color: "#123abc",
  links: [],
  tags: ["venue", "venue"],
  ownerIds: [ownerId],
};

const projectCreate = {
  name: "  Annual meetup  ",
  description: "  The big one  ",
  links: [],
  ownerIds: [ownerId],
  accessMode: "owners",
  accessGroupIds: [],
  status: "active",
};

describe("category route contracts", () => {
  beforeEach(() => {
    authorize.mockReset();
    process.env.TASKS_APP_URL = "http://localhost";
  });

  it("rejects invalid input before authorization", async () => {
    const { POST } = await import("@/app/api/categories/route");

    const response = await POST(request("POST", { name: "Incomplete" }));

    expect(response.status).toBe(400);
    expect(authorize).not.toHaveBeenCalled();
  });

  it("fails closed when the member cannot manage categories", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    authorize.mockResolvedValue({ user: { id: ownerId }, supabase: { rpc } });
    const { POST } = await import("@/app/api/categories/route");

    const response = await POST(request("POST", categoryCreate));

    expect(response.status).toBe(403);
    expect(rpc).toHaveBeenCalledWith("can_manage_categories");
  });

  it("reserves category access controls for app owners", async () => {
    const rpc = vi.fn(async (name: string) => ({
      data: name === "can_manage_categories",
      error: null,
    }));
    authorize.mockResolvedValue({ user: { id: ownerId }, supabase: { rpc } });
    const { POST } = await import("@/app/api/categories/route");

    const response = await POST(
      request("POST", {
        ...categoryCreate,
        accessMode: "restricted",
        accessGroupIds: [ownerId],
      }),
    );

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalledWith(
      "create_category_with_owners",
      expect.anything(),
    );
  });

  it("normalizes and creates a category transactionally", async () => {
    const category = { id: categoryId, name: "Operations" };
    const rpc = vi.fn(async (name: string) => {
      if (name === "create_category_with_owners")
        return { data: [category], error: null };
      return { data: true, error: null };
    });
    authorize.mockResolvedValue({ user: { id: ownerId }, supabase: { rpc } });
    const { POST } = await import("@/app/api/categories/route");

    const response = await POST(request("POST", categoryCreate));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ category });
    expect(rpc).toHaveBeenCalledWith("create_category_with_owners", {
      requested_name: "Operations",
      requested_description: "Event operations",
      requested_color: "#123abc",
      requested_links: [],
      requested_tags: ["venue"],
      requested_owner_ids: [ownerId],
      requested_access_mode: null,
      requested_group_ids: [],
    });
  });

  it("updates a category through the owner-replacement RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    authorize.mockResolvedValue({ user: { id: ownerId }, supabase: { rpc } });
    const { PATCH } = await import("@/app/api/categories/route");

    const response = await PATCH(
      request("PATCH", { ...categoryCreate, id: categoryId }),
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "update_category_with_owners",
      expect.objectContaining({ requested_category_id: categoryId }),
    );
  });

  it("prevents deletion while tasks still use the category", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(
        query({ data: { id: categoryId, name: "Operations" }, error: null }),
      )
      .mockReturnValueOnce(query({ data: null, count: 2, error: null }));
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    authorize.mockResolvedValue({
      user: { id: ownerId },
      supabase: { rpc, from },
    });
    const { DELETE } = await import("@/app/api/categories/route");

    const response = await DELETE(request("DELETE", { id: categoryId }));

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("every task");
    expect(from).toHaveBeenCalledTimes(2);
  });
});

describe("project route contracts", () => {
  beforeEach(() => {
    authorize.mockReset();
    process.env.TASKS_APP_URL = "http://localhost";
  });

  it("requires an onboarded owner to create a project", async () => {
    authorize.mockResolvedValue({
      response: Response.json({ code: "FORBIDDEN" }, { status: 403 }),
    });
    const { POST } = await import("@/app/api/projects/route");

    const response = await POST(request("POST", projectCreate));

    expect(response.status).toBe(403);
    expect(authorize).toHaveBeenCalledWith({ owner: true, onboarded: true });
  });

  it("creates a project through the visibility transaction", async () => {
    const project = { id: projectId, name: "Annual meetup" };
    const rpc = vi.fn().mockResolvedValue({ data: project, error: null });
    authorize.mockResolvedValue({ user: { id: ownerId }, supabase: { rpc } });
    const { POST } = await import("@/app/api/projects/route");

    const response = await POST(request("POST", projectCreate));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ project });
    expect(rpc).toHaveBeenCalledWith("create_project_with_visibility", {
      requested_name: "Annual meetup",
      requested_description: "The big one",
      requested_links: [],
      requested_owner_ids: [ownerId],
      requested_access_mode: "owners",
      requested_group_ids: [],
      requested_status: "active",
      requested_start_date: null,
      requested_due_date: null,
    });
  });

  it("hides a project when the member cannot manage it", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    authorize.mockResolvedValue({ user: { id: ownerId }, supabase: { rpc } });
    const { PATCH } = await import("@/app/api/projects/route");

    const response = await PATCH(
      request("PATCH", { id: projectId, name: "Renamed" }),
    );

    expect(response.status).toBe(404);
    expect(rpc).toHaveBeenCalledWith("can_manage_project", {
      project_id: projectId,
    });
  });

  it("maps project permission lookup failures to safe server errors", async () => {
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "sensitive permission failure" },
    });
    authorize.mockResolvedValue({ user: { id: ownerId }, supabase: { rpc } });
    const { PATCH } = await import("@/app/api/projects/route");

    const response = await PATCH(
      request("PATCH", { id: projectId, name: "Renamed" }),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Project permissions are temporarily unavailable.");
    expect(JSON.stringify(body)).not.toContain("sensitive permission failure");
    errorLog.mockRestore();
  });

  it("updates a manageable project transactionally", async () => {
    const rpc = vi.fn(async (name: string) => ({
      data: name === "can_manage_project" ? true : null,
      error: null,
    }));
    authorize.mockResolvedValue({ user: { id: ownerId }, supabase: { rpc } });
    const { PATCH } = await import("@/app/api/projects/route");

    const response = await PATCH(
      request("PATCH", { id: projectId, name: "Renamed" }),
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("replace_project_owners_and_update", {
      requested_project_id: projectId,
      requested_values: expect.objectContaining({ name: "Renamed" }),
    });
  });

  it("prevents deleting a project that still contains tasks", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce(
        query({ data: { id: projectId, name: "Annual meetup" }, error: null }),
      )
      .mockReturnValueOnce(query({ data: null, count: 3, error: null }));
    authorize.mockResolvedValue({
      user: { id: ownerId },
      supabase: { rpc, from },
    });
    const { DELETE } = await import("@/app/api/projects/route");

    const response = await DELETE(request("DELETE", { id: projectId }));

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("every task");
    expect(from).toHaveBeenCalledTimes(2);
  });
});
