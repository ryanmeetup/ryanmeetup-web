import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskAttachmentsPanel } from "@/components/tasks/TaskAttachmentsPanel";
import { TaskChecklistPanel } from "@/components/tasks/TaskChecklistPanel";
import type { Subtask, TaskAttachment } from "@/lib/tasks/task-types";

const staleItem = {
  id: "stale-item",
  task_id: "task",
  title: "A stale checklist item",
  is_completed: false,
  sort_order: 0,
  created_by: null,
  created_at: "2026-09-01T12:00:00.000Z",
} as unknown as Subtask;

const staleAttachment = {
  id: "stale-attachment",
  task_id: "task",
  name: "stale-notes.pdf",
  url: "https://example.com/stale-notes.pdf",
  file_path: "task/stale-notes.pdf",
  mime_type: "application/pdf",
  size_bytes: 1024,
  created_by: null,
  created_at: "2026-09-01T12:00:00.000Z",
} as unknown as TaskAttachment;

describe("checklist loading", () => {
  function renderPanel(loading: boolean) {
    return renderToStaticMarkup(
      createElement(TaskChecklistPanel, {
        items: [staleItem],
        loading,
        newItemTitle: "",
        onAdd: () => {},
        onAddPasted: () => {},
        onDelete: () => {},
        onNewItemTitleChange: () => {},
        onRename: async () => true,
        onToggle: () => {},
        saving: false,
      }),
    );
  }

  it("replaces cached items with placeholders while the task loads", () => {
    const markup = renderPanel(true);

    expect(markup).not.toContain(staleItem.title);
    expect(markup).toContain('data-task-checklist-skeleton=""');
    expect(markup).toContain('role="status">Loading checklist</span>');
  });

  it("shows the items once loaded", () => {
    const markup = renderPanel(false);

    expect(markup).toContain(staleItem.title);
    expect(markup).not.toContain("data-task-checklist-skeleton");
  });
});

describe("attachment loading", () => {
  function renderPanel(loading: boolean) {
    return renderToStaticMarkup(
      createElement(TaskAttachmentsPanel, {
        addingUrl: false,
        attachmentUrl: "",
        attachments: [staleAttachment],
        loading,
        onAddUrl: () => {},
        onAttachmentUrlChange: () => {},
        onRemove: () => {},
        onUploadFiles: () => {},
        previewAttachment: null,
        setPreviewAttachment: () => {},
        taskId: "task",
        uploadingFiles: false,
      }),
    );
  }

  it("replaces cached attachments with placeholders while the task loads", () => {
    const markup = renderPanel(true);

    expect(markup).not.toContain(staleAttachment.name);
    expect(markup.match(/data-task-attachment-skeleton=""/g)).toHaveLength(2);
    expect(markup).toContain('role="status">Loading attachments</span>');
  });

  it("shows the attachments once loaded", () => {
    const markup = renderPanel(false);

    expect(markup).toContain(staleAttachment.name);
    expect(markup).not.toContain("data-task-attachment-skeleton");
  });
});
