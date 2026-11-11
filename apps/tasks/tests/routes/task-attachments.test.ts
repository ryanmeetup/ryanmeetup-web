import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TASK_LINK_TITLE_MAX_LENGTH } from "@/lib/tasks/task-attachment-urls";

const authorize = vi.fn();
const rpc = vi.fn();
const insertAttachment = vi.fn();
const insertActivity = vi.fn();

vi.mock("@/lib/server/auth", () => ({ authorize }));
vi.mock("@/lib/server/admin-client", () => ({ getAdminClient: vi.fn() }));

const taskId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const validBody = { taskId, url: "example.com/brief" };
const request = (body: unknown = validBody) =>
  new Request("http://localhost/api/task-attachments", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });

describe("POST /api/task-attachments link titles", () => {
  beforeEach(() => {
    vi.stubEnv("TASKS_APP_URL", "http://localhost");
    for (const mock of [authorize, rpc, insertAttachment, insertActivity])
      mock.mockReset();
    rpc.mockResolvedValue({ data: true, error: null });
    insertAttachment.mockResolvedValue({ error: null });
    insertActivity.mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: "activity-1" }, error: null }),
      }),
    });
    authorize.mockResolvedValue({
      user: { id: userId },
      supabase: {
        rpc,
        from: (table: string) => ({
          insert:
            table === "task_attachments" ? insertAttachment : insertActivity,
        }),
      },
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("requires authentication before reading or saving a link", async () => {
    authorize.mockResolvedValue({
      response: Response.json({ error: "Sign in" }, { status: 401 }),
    });
    const { POST } = await import("@/app/api/task-attachments/route");

    expect((await POST(request())).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
    expect(insertAttachment).not.toHaveBeenCalled();
  });

  it("requires edit permission for the attachment's task", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const { POST } = await import("@/app/api/task-attachments/route");

    expect((await POST(request())).status).toBe(403);
    expect(insertAttachment).not.toHaveBeenCalled();
  });

  it("saves the chosen title and normalized URL, and uses the title in activity", async () => {
    const { POST } = await import("@/app/api/task-attachments/route");
    const response = await POST(
      request({ ...validBody, title: "  Launch plan  " }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      attachment: {
        name: "Launch plan",
        url: "https://example.com/brief",
        task_id: taskId,
        created_by: userId,
      },
    });
    expect(insertAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Launch plan",
        url: "https://example.com/brief",
      }),
    );
    expect(insertActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "attached “Launch plan”" }),
    );
    expect(rpc).toHaveBeenCalledWith("can_edit_task", {
      requested_task_id: taskId,
    });
  });

  it.each([undefined, "   "])(
    "keeps URL-derived names when the title is %s",
    async (title) => {
      const { POST } = await import("@/app/api/task-attachments/route");
      const response = await POST(request({ ...validBody, title }));

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        attachment: { name: "brief" },
      });
    },
  );

  it.each([
    { title: 42 },
    { title: "x".repeat(TASK_LINK_TITLE_MAX_LENGTH + 1) },
    { url: "javascript:alert(1)" },
    { taskId: "not-a-task-id" },
    { unexpected: "field" },
  ])("rejects invalid attachment input %j before writing", async (invalid) => {
    const { POST } = await import("@/app/api/task-attachments/route");

    expect((await POST(request({ ...validBody, ...invalid }))).status).toBe(
      400,
    );
    expect(insertAttachment).not.toHaveBeenCalled();
  });

  it("reports malformed JSON instead of throwing", async () => {
    const { POST } = await import("@/app/api/task-attachments/route");

    expect((await POST(new Request(request(), { body: "{" }))).status).toBe(
      400,
    );
    expect(insertAttachment).not.toHaveBeenCalled();
  });
});
