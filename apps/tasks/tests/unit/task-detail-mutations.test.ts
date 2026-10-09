import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachUrl,
  createComment,
  createSubtask,
  deleteComment,
  deleteSubtask,
  fetchTaskDetails,
  renameSubtask,
  setSubtaskCompleted,
  updateComment,
  uploadAttachment,
} from "@/lib/tasks/task-detail-mutations";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Captures the request the mutation made and replies with `body`. */
function stubFetch(body: unknown, init: { ok?: boolean } = {}) {
  const fetch = vi.fn(async () =>
    Object.assign(
      new Response(JSON.stringify(body), {
        status: init.ok === false ? 400 : 200,
      }),
      {},
    ),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const requestOf = (fetch: ReturnType<typeof stubFetch>) => {
  const [url, options] = fetch.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  return {
    url,
    method: options.method,
    body: options.body ? JSON.parse(options.body as string) : undefined,
  };
};

describe("task detail requests", () => {
  it("asks for a task's details by id and activity page", async () => {
    const fetch = stubFetch({
      subtasks: [],
      comments: [],
      activity: [],
      attachments: [],
      taskReferences: [],
      activityPage: { page: 2, hasMore: true },
    });
    const result = await fetchTaskDetails("task-1", 2);

    expect(requestOf(fetch).url).toBe(
      "/api/task-details?taskId=task-1&activityPage=2",
    );
    expect(result.activityPage).toEqual({ page: 2, hasMore: true });
  });

  it("sends a new checklist item with its sort order", async () => {
    const fetch = stubFetch({
      subtask: { id: "subtask-1" },
      activity: { id: "activity-1" },
    });
    await createSubtask({ taskId: "task-1", title: "Write it", sortOrder: 3 });

    expect(requestOf(fetch)).toEqual({
      url: "/api/task-details",
      method: "POST",
      body: {
        kind: "subtask",
        taskId: "task-1",
        value: "Write it",
        sortOrder: 3,
      },
    });
  });

  it("toggles a checklist item by id", async () => {
    const fetch = stubFetch({
      subtask: { id: "subtask-1" },
      activity: { id: "activity-1" },
    });
    await setSubtaskCompleted("subtask-1", true);

    expect(requestOf(fetch)).toEqual({
      url: "/api/task-details",
      method: "PATCH",
      body: { id: "subtask-1", completed: true },
    });
  });

  it("sends only the new title when renaming a checklist item", async () => {
    const fetch = stubFetch({
      subtask: { id: "subtask-1" },
      activity: { id: "activity-1" },
    });
    await renameSubtask("subtask-1", "Book the venue");

    expect(requestOf(fetch)).toEqual({
      url: "/api/task-details",
      method: "PATCH",
      body: { id: "subtask-1", title: "Book the venue" },
    });
  });

  it("escapes ids in delete query strings", async () => {
    const fetch = stubFetch({ id: "a b/c" });
    await deleteSubtask("a b/c");
    expect(requestOf(fetch).url).toBe("/api/task-details?id=a%20b%2Fc");

    const commentFetch = stubFetch({ id: "a b/c" });
    await deleteComment("a b/c");
    expect(requestOf(commentFetch).url).toBe(
      "/api/task-details?kind=comment&id=a%20b%2Fc",
    );
  });

  it("sends a reply with its parent comment", async () => {
    const fetch = stubFetch({
      comment: { id: "comment-2" },
      activity: { id: "activity-1" },
    });
    await createComment({
      taskId: "task-1",
      parentId: "comment-1",
      body: "Agreed",
    });

    expect(requestOf(fetch).body).toEqual({
      kind: "comment",
      taskId: "task-1",
      parentId: "comment-1",
      value: "Agreed",
    });
  });

  it("posts an uploaded file as multipart form data", async () => {
    const fetch = stubFetch({ attachment: { id: "attachment-1" } });
    await uploadAttachment("task-1", new File(["hi"], "notes.txt"));

    const [url, options] = fetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/task-attachments");
    expect(options.body).toBeInstanceOf(FormData);
    // The browser has to set the multipart boundary itself.
    expect(options.headers).not.toMatchObject({
      "Content-Type": "application/json",
    });
  });
});

describe("guarding against an incomplete success", () => {
  it("rejects a checklist item saved without its activity row", async () => {
    stubFetch({ subtask: { id: "subtask-1" } });
    await expect(
      createSubtask({ taskId: "task-1", title: "Write it", sortOrder: 0 }),
    ).rejects.toThrow("The checklist item could not be added.");
  });

  it("rejects a comment response with no comment in it", async () => {
    stubFetch({});
    await expect(
      createComment({ taskId: "task-1", parentId: null, body: "Hello" }),
    ).rejects.toThrow("The comment could not be added.");

    stubFetch({ comment: null });
    await expect(updateComment("comment-1", "Edited")).rejects.toThrow(
      "The comment could not be updated.",
    );
  });

  it("rejects an attachment response with no attachment in it", async () => {
    stubFetch({ activity: { id: "activity-1" } });
    await expect(attachUrl("task-1", "https://example.com")).rejects.toThrow(
      "The URL could not be attached.",
    );
  });

  it("keeps an attachment whose audit row could not be recorded", async () => {
    stubFetch({ attachment: { id: "attachment-1" }, activity: null });
    await expect(
      attachUrl("task-1", "https://example.com"),
    ).resolves.toMatchObject({ attachment: { id: "attachment-1" } });
  });

  it("surfaces the server's own message ahead of the fallback", async () => {
    stubFetch({ error: "That task is archived." }, { ok: false });
    await expect(
      createSubtask({ taskId: "task-1", title: "Write it", sortOrder: 0 }),
    ).rejects.toThrow("That task is archived.");
  });
});
