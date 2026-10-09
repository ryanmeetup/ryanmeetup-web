import { Avatar, Button, IconButton, Textarea } from "@ryanmeetup/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  FiCornerUpLeft,
  FiEdit2,
  FiMessageSquare,
  FiTrash2,
} from "react-icons/fi";
import { CountBadge } from "@/components/global";
import { SkeletonBar } from "@/components/global/SkeletonBar";
import { withAccessPreview } from "@/lib/access/access-preview";
import { profileDisplayName } from "@/lib/presentation";
import { taskCommentSegments } from "@/lib/tasks/task-comment-references";
import {
  buildTaskCommentThreads,
  type TaskCommentThread,
} from "@/lib/tasks/task-comment-threads";
import { taskPath } from "@/lib/tasks/task-key";
import type { TaskComment, TaskReference } from "@/lib/tasks/task-types";
import type { AccessPreview, Profile } from "@/lib/workspace/workspace-types";
import { formatTimestamp } from "@/lib/date-format";

/** Mirrors a comment's avatar, author line, and body while they load. */
function TaskCommentSkeletons() {
  return ["w-3/4", "w-1/2"].map((width) => (
    <div
      key={width}
      aria-hidden="true"
      data-task-comment-skeleton=""
      className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 py-1"
    >
      <SkeletonBar round className="mt-0.5 h-8 w-8" />
      <div className="min-w-0 space-y-2 py-0.5">
        <SkeletonBar className="h-3.5 w-32" />
        <SkeletonBar className={`h-4 ${width}`} />
      </div>
    </div>
  ));
}

export function TaskCommentsPanel({
  comment,
  comments: loadedComments,
  loading,
  currentProfileId,
  editingBody,
  editingComment,
  onCancelEdit,
  onClear,
  onCommentChange,
  onDelete,
  onEdit,
  onEditingBodyChange,
  onSave,
  onSubmit,
  onCancelReply,
  onReplyChange,
  onReplySubmit,
  onStartReply,
  previewing,
  profiles,
  reply,
  replyingTo,
  saving,
  tasks,
  accessPreview,
}: {
  comment: string;
  comments: TaskComment[];
  /** The task's comments are being fetched, so any held here may be stale. */
  loading: boolean;
  currentProfileId: string;
  editingBody: string;
  editingComment: TaskComment | null;
  onCancelEdit: () => void;
  onClear: () => void;
  onCommentChange: (value: string) => void;
  onDelete: (comment: TaskComment) => void;
  onEdit: (comment: TaskComment) => void;
  onEditingBodyChange: (value: string) => void;
  onSave: () => void;
  onSubmit: () => void;
  onCancelReply: () => void;
  onReplyChange: (value: string) => void;
  onReplySubmit: () => void;
  onStartReply: (comment: TaskComment) => void;
  previewing: boolean;
  profiles: Profile[];
  reply: string;
  replyingTo: TaskComment | null;
  saving: boolean;
  tasks: TaskReference[];
  accessPreview?: AccessPreview;
}) {
  const comments = loading ? [] : loadedComments;
  const threads = buildTaskCommentThreads(comments);

  function renderThread(thread: TaskCommentThread, depth = 0): ReactNode {
    const item = thread.comment;
    const profile = profiles.find((entry) => entry.id === item.created_by);
    const author = profileDisplayName(profile);
    const canManage = !previewing && item.created_by === currentProfileId;
    const isReplying = replyingTo?.id === item.id;

    return (
      <div
        key={item.id}
        className={
          depth > 0
            ? "ml-4 border-l-2 border-black/10 pl-3 dark:border-white/10 sm:ml-6"
            : undefined
        }
      >
        <article className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 py-1 text-sm">
          <Avatar
            className="mt-0.5"
            name={author}
            size={depth > 0 ? "sm" : "md"}
            src={profile?.avatar_url}
          />
          <div className="min-w-0 flex-1">
            {editingComment?.id === item.id ? (
              <div className="space-y-2">
                <Textarea
                  id={`edit-comment-${item.id}`}
                  label="Edit comment"
                  hideLabel
                  name={`edit-comment-${item.id}`}
                  value={editingBody}
                  onChange={(event) => onEditingBodyChange(event.target.value)}
                  rows={2}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={saving}
                    onClick={onCancelEdit}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    loading={saving}
                    disabled={!editingBody.trim()}
                    onClick={onSave}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <strong className="font-semibold text-black dark:text-white">
                    {author}
                  </strong>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-black/45 dark:text-white/45">
                    <time>{formatTimestamp(item.created_at)}</time>
                    {item.edited_at && (
                      <span
                        aria-label={`Edited ${formatTimestamp(item.edited_at)}`}
                      >
                        · Edited
                      </span>
                    )}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed text-black/80 dark:text-white/80">
                  {taskCommentSegments(item.body, tasks).map(
                    (segment, index) =>
                      segment.kind === "task" ? (
                        <Link
                          key={`${segment.task.id}-${index}`}
                          className="font-semibold underline decoration-black/30 underline-offset-2 hover:decoration-black focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 dark:decoration-white/30 dark:hover:decoration-white"
                          href={withAccessPreview(
                            taskPath(segment.task),
                            accessPreview,
                          )}
                        >
                          {segment.value}
                        </Link>
                      ) : (
                        segment.value
                      ),
                  )}
                </p>
                {!previewing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="-ml-3 mt-1 text-black/55 dark:text-white/55"
                    leftIcon={<FiCornerUpLeft aria-hidden />}
                    onClick={() => onStartReply(item)}
                  >
                    Reply
                  </Button>
                )}
              </>
            )}
          </div>
          {canManage && editingComment?.id !== item.id && (
            <span className="flex shrink-0 gap-1">
              <IconButton
                label={`Edit comment by ${author}`}
                variant="edit"
                onClick={() => onEdit(item)}
              >
                <FiEdit2 />
              </IconButton>
              <IconButton
                label={`Delete comment by ${author}`}
                variant="danger"
                onClick={() => onDelete(item)}
              >
                <FiTrash2 />
              </IconButton>
            </span>
          )}
        </article>

        {isReplying && (
          <div className="ml-9 mt-2 space-y-2 rounded-xl border border-black/10 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035]">
            <Textarea
              id={`reply-comment-${item.id}`}
              label={`Reply to ${author}`}
              name={`reply-comment-${item.id}`}
              value={reply}
              onChange={(event) => onReplyChange(event.target.value)}
              placeholder={`Reply to ${author}…`}
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={saving}
                onClick={onCancelReply}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="action"
                size="sm"
                loading={saving}
                disabled={!reply.trim()}
                onClick={onReplySubmit}
              >
                Reply
              </Button>
            </div>
          </div>
        )}

        {thread.replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {thread.replies.map((child) => renderThread(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
        <FiMessageSquare /> Comments{" "}
        {!loading && <CountBadge>{comments.length}</CountBadge>}
      </h3>
      {loading && (
        <div className="space-y-3">
          <span className="sr-only" role="status">
            Loading comments
          </span>
          <TaskCommentSkeletons />
        </div>
      )}
      {comments.length > 0 && (
        <div className="max-h-72 space-y-3 overflow-y-auto overscroll-contain pr-2">
          {threads.map((thread) => renderThread(thread))}
        </div>
      )}
      <Textarea
        id="task-comment"
        label="Comment"
        hideLabel
        name="task-comment"
        value={comment}
        onChange={(event) => onCommentChange(event.target.value)}
        placeholder="Add a comment…"
        rows={2}
      />
      <div className="grid w-full grid-cols-2 gap-2">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={saving || !comment.trim()}
          onClick={onClear}
        >
          Clear
        </Button>
        <Button
          type="button"
          variant="action"
          className="w-full"
          loading={saving && !replyingTo}
          disabled={saving || !comment.trim()}
          onClick={onSubmit}
        >
          Comment
        </Button>
      </div>
    </section>
  );
}
