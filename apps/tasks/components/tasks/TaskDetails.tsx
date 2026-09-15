"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Card, ConfirmationDialog } from "@ryanmeetup/ui";
import type { Task } from "@/lib/tasks/task-types";
import type { TaskActivity } from "@/lib/activity/activity-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { TaskActivityPanel } from "./TaskActivityPanel";
import { TaskChecklistPanel } from "./TaskChecklistPanel";
import { TaskCommentsPanel } from "./TaskCommentsPanel";
import { TaskAttachmentsPanel } from "./TaskAttachmentsPanel";
import { useTaskAttachments } from "./useTaskAttachments";
import { useTaskChecklist } from "./useTaskChecklist";
import { useTaskComments } from "./useTaskComments";
import { useTaskDetailData } from "./useTaskDetailData";

type TaskDetailsProps = {
  task: Task;
  workspace: {
    data: WorkspaceData;
    demoMode: boolean;
    setData: Dispatch<SetStateAction<WorkspaceData>>;
  };
  display: {
    active: boolean;
    className?: string;
    pageLayout?: boolean;
    section?: "all" | "work" | "comment" | "activity";
    conversationHeight?: number;
  };
};

/** On a task page each group is its own card; in the modal they run together. */
function DetailGroup({
  card,
  className,
  children,
  header,
}: {
  card: boolean;
  className?: string;
  children: ReactNode;
  header?: ReactNode;
}) {
  return card ? (
    <Card className={`space-y-6 ${className ?? ""}`}>
      {header}
      {children}
    </Card>
  ) : (
    <>{children}</>
  );
}

export function TaskDetails({ task, workspace, display }: TaskDetailsProps) {
  const { data, demoMode, setData } = workspace;
  const {
    active,
    className,
    pageLayout = false,
    section = "all",
    conversationHeight,
  } = display;

  /**
   * Demo mode has no save transaction to write an audit row, so it records its
   * own to keep the activity panel aligned with the server-backed path.
   */
  async function recordActivity(action: string) {
    const entry: TaskActivity = {
      id: crypto.randomUUID(),
      task_id: task.id,
      actor_id: data.currentProfile.id,
      action,
      details: {},
      created_at: new Date().toISOString(),
    };
    setData((current) => ({
      ...current,
      activity: [entry, ...current.activity],
    }));
  }

  const context = { task, data, demoMode, setData, recordActivity };
  const details = useTaskDetailData({ ...context, section });
  const checklist = useTaskChecklist(context);
  const comments = useTaskComments(context);
  const attachments = useTaskAttachments({
    ...context,
    pasteEnabled: active && (section === "all" || section === "work"),
  });

  return (
    <div
      className={`${pageLayout ? "" : "space-y-6 border-t border-black/10 pt-6 dark:border-white/10"} ${className ?? ""}`}
    >
      {(section === "all" || section === "work") && (
        <DetailGroup
          card={pageLayout}
          header={
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
              Task work
            </h2>
          }
        >
          <TaskChecklistPanel
            items={checklist.items}
            newItemTitle={checklist.newItemTitle}
            onAdd={() => void checklist.add()}
            onAddPasted={(pasted) => void checklist.addPasted(pasted)}
            onDelete={(item) => void checklist.remove(item)}
            onNewItemTitleChange={checklist.setNewItemTitle}
            onToggle={(item) => void checklist.toggle(item)}
            saving={checklist.saving}
          />

          <TaskAttachmentsPanel
            addingUrl={attachments.addingUrl}
            attachmentUrl={attachments.url}
            attachments={attachments.attachments}
            onAddUrl={() => void attachments.addUrl()}
            onAttachmentUrlChange={attachments.setUrl}
            onRemove={(item) => void attachments.remove(item)}
            onUploadFiles={(files) => void attachments.upload(files)}
            previewAttachment={attachments.preview}
            setPreviewAttachment={attachments.setPreview}
            taskId={task.id}
            uploadingFiles={attachments.uploading}
          />
        </DetailGroup>
      )}

      {(section === "all" || section === "comment") && (
        <DetailGroup card={pageLayout} className="!pt-5">
          <TaskCommentsPanel
            comment={comments.draft}
            comments={comments.comments}
            currentProfileId={data.currentProfile.id}
            editingBody={comments.editingBody}
            editingComment={comments.editing}
            onCancelEdit={() => comments.setEditing(null)}
            onClear={() => comments.setDraft("")}
            onCommentChange={comments.setDraft}
            onDelete={comments.setPendingDelete}
            onEdit={(item) => {
              comments.setReply("");
              comments.setReplyingTo(null);
              comments.setEditing(item);
              comments.setEditingBody(item.body);
            }}
            onEditingBodyChange={comments.setEditingBody}
            onSave={() => void comments.saveEdit()}
            onSubmit={() => void comments.add()}
            onCancelReply={() => {
              comments.setReply("");
              comments.setReplyingTo(null);
            }}
            onReplyChange={comments.setReply}
            onReplySubmit={() =>
              comments.replyingTo
                ? void comments.add(comments.replyingTo)
                : undefined
            }
            onStartReply={(item) => {
              comments.setEditing(null);
              comments.setReply("");
              comments.setReplyingTo(item);
            }}
            previewing={Boolean(data.accessPreview)}
            profiles={data.profiles}
            reply={comments.reply}
            replyingTo={comments.replyingTo}
            saving={comments.saving}
            tasks={data.taskReferences ?? data.tasks}
            accessPreview={data.accessPreview}
          />
        </DetailGroup>
      )}

      {(section === "all" || section === "activity") && (
        <DetailGroup card={pageLayout} className="overflow-hidden">
          <TaskActivityPanel
            activity={details.activity}
            conversationHeight={conversationHeight}
            hasMore={details.hasMore}
            loading={details.loading}
            loadingFirstPage={details.loadingFirstPage}
            lookups={data}
            onLoadMore={details.loadMore}
            pageLayout={pageLayout}
          />
        </DetailGroup>
      )}

      <ConfirmationDialog
        open={Boolean(comments.pendingDelete)}
        setOpen={(open) => {
          if (!open) comments.setPendingDelete(null);
        }}
        title="Delete Comment?"
        description="This comment will be permanently removed."
        confirmLabel="Delete comment"
        pendingLabel="Deleting..."
        pending={comments.saving}
        destructive
        onConfirm={() => void comments.confirmDelete()}
      />
    </div>
  );
}
