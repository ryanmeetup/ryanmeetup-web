import { beforeEach, describe, expect, it, vi } from "vitest";
import { WORKSPACE_AREA_KEYS } from "@/lib/access/workspace-areas";

const authorize = vi.fn();
const getAdminClient = vi.fn();
vi.mock("@/lib/server/auth", () => ({ authorize }));
vi.mock("@/lib/server/admin-client", () => ({ getAdminClient }));

const projectId = "11111111-1111-4111-8111-111111111111";
const hiddenProjectId = "22222222-2222-4222-8222-222222222222";
const categoryId = "33333333-3333-4333-8333-333333333333";
const noteId = "44444444-4444-4444-8444-444444444444";
const userId = "55555555-5555-4555-8555-555555555555";

/**
 * A thenable query builder: every filter returns itself, and awaiting it hands
 * back the rows configured for the table, so the stub does not have to know
 * which filters the route applies.
 */
const builderFor = (rows: unknown[]) => {
  const result = { data: rows, error: null };
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  for (const method of [
    "select",
    "eq",
    "in",
    "is",
    "ilike",
    "not",
    "gte",
    "or",
    "contains",
    "order",
    "limit",
  ])
    builder[method] = () => builder;
  return builder;
};

const auditEvent = (
  action: string,
  overrides: {
    target_type?: string;
    target_id?: string | null;
    after_state?: Record<string, unknown>;
  } = {},
) => ({
  id: `event-${action}-${overrides.target_id ?? "none"}`,
  actor_id: "someone-else",
  action,
  target_type: overrides.target_type ?? action.split(".")[0],
  target_id: overrides.target_id ?? null,
  after_state: { activity: true, ...overrides.after_state },
  created_at: "2026-08-31T12:00:00.000Z",
});

/** Newest first, so the route's sort preserves the order a case lists. */
const inOrder = (events: ReturnType<typeof auditEvent>[]) =>
  events.map((event, index) => ({
    ...event,
    created_at: new Date(
      Date.UTC(2026, 7, 31, 12) - index * 1000,
    ).toISOString(),
  }));

/**
 * Answers the two RPCs the route asks about the caller: whether they are an
 * app owner, and which lockable pages they reach.
 */
const rpcFor = (
  { owner = false, areas = [...WORKSPACE_AREA_KEYS] } = {} as {
    owner?: boolean;
    areas?: string[];
  },
) =>
  vi.fn(async (name: string) =>
    name === "is_app_owner"
      ? { data: owner, error: null }
      : name === "accessible_workspace_areas"
        ? { data: areas, error: null }
        : { data: null, error: null },
  );

/** Runs the route against one set of audit rows and returns the actions kept. */
async function visibleActions(
  events: ReturnType<typeof auditEvent>[],
  caller: { owner?: boolean; areas?: string[] } = {},
) {
  authorize.mockResolvedValue({
    user: { id: userId },
    supabase: {
      rpc: rpcFor(caller),
      from: (table: string) =>
        builderFor(
          table === "projects"
            ? [{ id: projectId }]
            : table === "work_groups"
              ? [{ id: categoryId }]
              : [],
        ),
    },
  });
  getAdminClient.mockReturnValue({ from: () => builderFor(inOrder(events)) });
  const { GET } = await import("@/app/api/activity/route");
  const response = await GET(new Request("http://localhost/api/activity"));
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    activity: { action: string; details: Record<string, unknown> }[];
  };
  return body;
}

/** One recorded status move, as the feed reads it back off `task_activity`. */
const movedTask = (
  id: string,
  from: string | null,
  to: string | null,
): Record<string, unknown> => ({
  id,
  task_id: `task-${id}`,
  actor_id: userId,
  action: "moved task",
  details: { from_status_id: from, status_id: to },
  created_at: "2026-08-31T12:00:00.000Z",
  tasks: { id: `task-${id}`, project_id: projectId },
});

/** Runs the route over a set of moves and returns the event ids it kept. */
async function movesMatching(query: string) {
  const rows = [
    movedTask("todo-to-done", "s1", "s2"),
    movedTask("backlog-to-done", "s0", "s2"),
    movedTask("todo-to-progress", "s1", "s3"),
    movedTask("no-origin-to-done", null, "s2"),
  ].map((row, index) => ({
    ...row,
    created_at: new Date(
      Date.UTC(2026, 7, 31, 12) - index * 1000,
    ).toISOString(),
  }));
  authorize.mockResolvedValue({
    user: { id: userId },
    supabase: {
      rpc: rpcFor(),
      from: (table: string) =>
        builderFor(
          table === "task_activity"
            ? rows
            : table === "projects"
              ? [{ id: projectId }]
              : [],
        ),
    },
  });
  getAdminClient.mockReturnValue({ from: () => builderFor([]) });
  const { GET } = await import("@/app/api/activity/route");
  const response = await GET(
    new Request(`http://localhost/api/activity?${query}`),
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { activity: { id: string }[] };
  return body.activity.map((item) => item.id);
}

describe("GET /api/activity", () => {
  beforeEach(() => {
    authorize.mockReset();
    getAdminClient.mockReset();
  });

  it("refuses to render half a feed when the service key is missing", async () => {
    authorize.mockResolvedValue({
      user: { id: userId },
      supabase: { rpc: rpcFor(), from: () => builderFor([]) },
    });
    getAdminClient.mockReturnValue(null);
    const { GET } = await import("@/app/api/activity/route");
    const response = await GET(new Request("http://localhost/api/activity"));
    expect(response.status).toBe(503);
  });

  it("shows calendar activity, scoped the way the calendar itself is", async () => {
    const { activity } = await visibleActions([
      auditEvent("calendar.create", {
        target_type: "calendar_event",
        target_id: "event-1",
        after_state: { resource_name: "Offsite", project_id: projectId },
      }),
      auditEvent("calendar.update", {
        target_type: "calendar_event",
        target_id: "event-2",
        after_state: { resource_name: "Hidden", project_id: hiddenProjectId },
      }),
      auditEvent("calendar.delete", {
        target_type: "calendar_event",
        target_id: "event-3",
        after_state: { resource_name: "Unscoped" },
      }),
    ]);
    expect(activity.map((item) => item.details.resource_name)).toEqual([
      "Offsite",
      "Unscoped",
    ]);
  });

  it("shows a deleted resource to the whole team, but not its attachments", async () => {
    const { activity } = await visibleActions([
      auditEvent("project.delete", {
        target_type: "project",
        target_id: hiddenProjectId,
        after_state: { resource_name: "Gone" },
      }),
      auditEvent("category.delete", {
        target_type: "category",
        target_id: "vanished-category",
        after_state: { resource_name: "Gone too" },
      }),
      auditEvent("note.delete", {
        target_type: "note",
        target_id: noteId,
        after_state: { resource_name: "Gone note" },
      }),
      auditEvent("project.attachment.delete", {
        target_type: "project",
        target_id: hiddenProjectId,
        after_state: { resource_name: "Restricted", attachment_name: "x.pdf" },
      }),
    ]);
    expect(activity.map((item) => item.action)).toEqual([
      "project.delete",
      "category.delete",
      "note.delete",
    ]);
  });

  it("shows a contact category rather than checking it against work groups", async () => {
    const { activity } = await visibleActions([
      auditEvent("contact_category.create", {
        target_type: "contact_category",
        target_id: "contact-category-1",
        after_state: { resource_name: "Venues", resource_href: "/contacts" },
      }),
    ]);
    expect(activity).toHaveLength(1);
    expect(activity[0].details.resource_href).toBe("/contacts");
  });

  it("hides note, contact, and calendar activity from a member locked out of those pages", async () => {
    const events = [
      auditEvent("note.delete", {
        target_type: "note",
        target_id: noteId,
        after_state: { resource_name: "Gone note" },
      }),
      auditEvent("contact_category.create", {
        target_type: "contact_category",
        target_id: "contact-category-1",
        after_state: { resource_name: "Venues" },
      }),
      auditEvent("calendar.delete", {
        target_type: "calendar_event",
        target_id: "event-3",
        after_state: { resource_name: "Unscoped" },
      }),
      auditEvent("status.delete", {
        target_type: "status",
        target_id: "status-1",
        after_state: { resource_name: "In Review" },
      }),
    ];
    const locked = await visibleActions(events, { areas: [] });
    expect(locked.activity.map((item) => item.action)).toEqual([
      "status.delete",
    ]);
    const unlocked = await visibleActions(events, { areas: ["notes"] });
    expect(unlocked.activity.map((item) => item.action)).toEqual([
      "note.delete",
      "status.delete",
    ]);
  });

  it("shows page-access changes to app owners only", async () => {
    const event = auditEvent("workspace_area.access.update", {
      target_type: "workspace_area",
      after_state: { resource_name: "Contacts", detail: "Now restricted" },
    });
    const member = await visibleActions([event]);
    expect(member.activity).toHaveLength(0);
    const owner = await visibleActions([event], { owner: true });
    expect(owner.activity.map((item) => item.details.resource_name)).toEqual([
      "Contacts",
    ]);
  });

  it("carries the attachment file name and free-text detail through", async () => {
    const { activity } = await visibleActions([
      auditEvent("project.attachment.add", {
        target_type: "project",
        target_id: projectId,
        after_state: {
          resource_name: "Fall Launch",
          attachment_name: "brief.pdf",
        },
      }),
      auditEvent("project.owners.update", {
        target_type: "project",
        target_id: projectId,
        after_state: { resource_name: "Fall Launch", detail: "Added Sam" },
      }),
    ]);
    expect(activity.map((item) => item.details.attachment_name)).toEqual([
      "brief.pdf",
      undefined,
    ]);
    expect(activity.map((item) => item.details.detail)).toEqual([
      undefined,
      "Added Sam",
    ]);
  });

  it("filters moves by where a task landed, and by the transition", async () => {
    expect(await movesMatching("moves=to:s2")).toEqual([
      "todo-to-done",
      "backlog-to-done",
      "no-origin-to-done",
    ]);
    expect(await movesMatching("moves=to:s2,from:s1")).toEqual([
      "todo-to-done",
    ]);
    expect(await movesMatching("moves=to:s2,to:s3")).toEqual([
      "todo-to-done",
      "backlog-to-done",
      "todo-to-progress",
      "no-origin-to-done",
    ]);
    expect(await movesMatching("excludeMoves=to:s2")).toEqual([
      "todo-to-progress",
    ]);
  });

  it("keeps workspace-wide events that belong to no project or category", async () => {
    const { activity } = await visibleActions([
      auditEvent("status.delete", {
        target_type: "status",
        target_id: "status-1",
        after_state: { resource_name: "In Review" },
      }),
      auditEvent("team.invite", {
        target_type: "profile",
        target_id: "profile-1",
        after_state: { resource_name: "Sam" },
      }),
      auditEvent("settings.instance.update", {
        target_type: "workspace",
        after_state: { resource_name: "Workspace settings" },
      }),
      auditEvent("something.unrecognized", {
        target_type: "mystery",
        target_id: "mystery-1",
      }),
    ]);
    expect(activity.map((item) => item.action)).toEqual([
      "status.delete",
      "team.invite",
      "settings.instance.update",
    ]);
  });
});
