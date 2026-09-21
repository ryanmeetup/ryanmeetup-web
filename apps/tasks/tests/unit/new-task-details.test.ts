import { describe, expect, it, vi } from "vitest";
import { persistNewTaskDetails } from "@/lib/tasks/new-task-details";

describe("new task details", () => {
  it("persists the completion state of checklist items", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            subtasks: [],
            activity: { id: "activity-1" },
          }),
        ),
      ),
    );
    vi.stubGlobal("fetch", fetch);

    await persistNewTaskDetails({
      taskId: "task-1",
      draft: {
        checklist: [
          {
            id: "ef900db9-27d0-4e19-a757-bd8319815a0f",
            title: "Already handled",
            completed: true,
          },
          {
            id: "3f2cb9d2-cb84-4600-985d-aaf21b122486",
            title: "Still to do",
            completed: false,
          },
        ],
        files: [],
        urls: [],
      },
      demoMode: false,
      setData: vi.fn(),
    });

    const [, options] = fetch.mock.calls[0];
    expect(JSON.parse(String(options?.body))).toEqual({
      kind: "subtasks",
      taskId: "task-1",
      items: [
        {
          id: "ef900db9-27d0-4e19-a757-bd8319815a0f",
          title: "Already handled",
          completed: true,
        },
        {
          id: "3f2cb9d2-cb84-4600-985d-aaf21b122486",
          title: "Still to do",
          completed: false,
        },
      ],
      sortOrder: 0,
    });
  });
});
