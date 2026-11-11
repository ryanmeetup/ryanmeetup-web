import type { Dispatch, SetStateAction } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { persistNewTaskDetails } from "@/lib/tasks/new-task-details";
import type { TaskActivity } from "@/lib/activity/activity-types";
import type { TaskAttachment } from "@/lib/tasks/task-types";
import { demoData } from "@/lib/workspace/demo-data";
import {
  reconcileAttachmentEvent,
  taskChildReconcilers,
} from "@/lib/workspace/workspace-reconciliation";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";

afterEach(() => vi.unstubAllGlobals());

describe("new task details", () => {
  it.each(["before response", "after response"])(
    "keeps each saved attachment and audit row once when realtime arrives %s",
    async (delivery) => {
      let data = structuredClone(demoData);
      const taskId = data.tasks[0].id;
      const saved: { attachment: TaskAttachment; activity: TaskActivity }[] =
        [];
      const setData: Dispatch<SetStateAction<WorkspaceData>> = (update) => {
        data = typeof update === "function" ? update(data) : update;
      };
      const receive = ({ attachment, activity }: (typeof saved)[number]) => {
        data = reconcileAttachmentEvent(data, {
          eventType: "INSERT",
          new: {
            ...attachment,
            url: attachment.file_path ? "" : attachment.url,
          },
          old: {},
        });
        data = taskChildReconcilers.task_activity(data, {
          eventType: "INSERT",
          new: activity,
          old: {},
        });
      };
      const request = vi.fn<typeof globalThis.fetch>(async (_url, options) => {
        const isFile = options?.body instanceof FormData;
        const attachment: TaskAttachment = {
          id: isFile ? "saved-file" : "saved-link",
          task_id: taskId,
          name: isFile ? "brief.txt" : "Reference docs",
          url: isFile
            ? "https://example.com/signed-file"
            : "https://example.com/reference",
          file_path: isFile ? `${taskId}/brief.txt` : null,
          mime_type: isFile ? "text/plain" : null,
          size_bytes: isFile ? 5 : null,
          created_by: data.currentProfile.id,
          created_at: "2026-11-11T12:00:00.000Z",
        };
        const activity: TaskActivity = {
          id: `activity-${attachment.id}`,
          task_id: taskId,
          actor_id: data.currentProfile.id,
          action: `attached “${attachment.name}”`,
          details: { attachment_id: attachment.id },
          created_at: attachment.created_at,
        };
        const result = { attachment, activity };
        saved.push(result);
        if (delivery === "before response") receive(result);
        return new Response(JSON.stringify(result));
      });
      vi.stubGlobal("fetch", request);

      const failures = await persistNewTaskDetails({
        taskId,
        draft: {
          checklist: [],
          files: [new File(["brief"], "brief.txt", { type: "text/plain" })],
          urls: [
            {
              id: "draft-link",
              url: "https://example.com/reference",
              title: "Reference docs",
            },
          ],
        },
        demoMode: false,
        setData,
      });
      if (delivery === "after response") saved.forEach(receive);

      expect(failures).toBe(0);
      expect(request).toHaveBeenCalledTimes(2);
      expect(JSON.parse(String(request.mock.calls[1][1]?.body))).toMatchObject({
        title: "Reference docs",
      });
      expect(data.attachments).toEqual(
        saved.map((result) => result.attachment),
      );
      for (const { activity } of saved) {
        expect(
          data.activity.filter((entry) => entry.id === activity.id),
        ).toEqual([activity]);
      }
    },
  );

  it("keeps chosen link titles when creating a task in demo mode", async () => {
    let data = structuredClone(demoData);
    const setData: Dispatch<SetStateAction<WorkspaceData>> = (update) => {
      data = typeof update === "function" ? update(data) : update;
    };

    await persistNewTaskDetails({
      taskId: data.tasks[0].id,
      demoMode: true,
      draft: {
        checklist: [],
        files: [],
        urls: [
          {
            id: "custom",
            url: "https://example.com/123",
            title: "  Launch plan  ",
          },
          { id: "legacy", url: "https://example.com/notes" },
        ],
      },
      setData,
    });

    expect(data.attachments.map((attachment) => attachment.name)).toEqual([
      "Launch plan",
      "notes",
    ]);
  });

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
