import { describe, expect, it } from "vitest";
import { withTaskAttachment } from "@/lib/tasks/task-attachment-state";
import type { TaskAttachment } from "@/lib/tasks/task-types";
import { demoData } from "@/lib/workspace/demo-data";
import { reconcileAttachmentEvent } from "@/lib/workspace/workspace-reconciliation";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";

function attachment(overrides: Partial<TaskAttachment> = {}): TaskAttachment {
  return {
    id: "attachment-1",
    task_id: demoData.tasks[0].id,
    name: "example.com/brief",
    url: "https://example.com/brief",
    file_path: null,
    mime_type: null,
    size_bytes: null,
    created_by: demoData.currentProfile.id,
    created_at: "2026-11-11T12:00:00.000Z",
    ...overrides,
  };
}

const insert = (current: WorkspaceData, row: TaskAttachment) =>
  reconcileAttachmentEvent(current, {
    eventType: "INSERT",
    new: row,
    old: {},
  });

describe("task attachment reconciliation", () => {
  it.each(["response first", "realtime first"])(
    "keeps one link when the request and realtime deliver the same row: %s",
    (order) => {
      const current = structuredClone(demoData);
      const unrelated = attachment({
        id: "attachment-2",
        url: "https://example.com/other",
      });
      current.attachments = [unrelated];
      const link = attachment();
      const respond = withTaskAttachment({ attachment: link });

      const saved =
        order === "response first"
          ? insert(respond(current), link)
          : respond(insert(current, link));

      expect(saved.attachments).toEqual([unrelated, link]);
      expect(current.attachments).toEqual([unrelated]);

      const removed = reconcileAttachmentEvent(saved, {
        eventType: "DELETE",
        new: {},
        old: { id: link.id },
      });
      expect(removed.attachments).toEqual([unrelated]);
    },
  );

  it.each(["response first", "realtime first"])(
    "keeps one uploaded file and its signed URL: %s",
    (order) => {
      const current = structuredClone(demoData);
      const file = attachment({
        file_path: "task-1/file.pdf",
        mime_type: "application/pdf",
      });
      const realtimeRow = { ...file, url: "" };
      const respond = withTaskAttachment({ attachment: file });

      const saved =
        order === "response first"
          ? insert(respond(current), realtimeRow)
          : respond(insert(current, realtimeRow));

      expect(saved.attachments).toEqual([file]);
    },
  );

  it("collapses existing copies of the same ID without merging separate attachments to the same URL", () => {
    const current = structuredClone(demoData);
    const link = attachment();
    const separateLink = attachment({
      id: "attachment-2",
      task_id: demoData.tasks[1].id,
    });
    current.attachments = [link, separateLink, link];
    const updated = { ...link, name: "Project brief" };

    const saved = withTaskAttachment({ attachment: updated })(current);

    expect(saved.attachments).toEqual([updated, separateLink]);
    expect(current.attachments).toEqual([link, separateLink, link]);
  });
});
