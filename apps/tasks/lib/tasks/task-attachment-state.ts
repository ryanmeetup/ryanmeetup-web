import { withRecordedRows } from "@/lib/activity/activity-state";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import type { AttachmentResult } from "./task-detail-mutations";
import type { TaskAttachment } from "./task-types";

/** A request and its realtime event describe one row, whichever arrives first. */
export function mergeTaskAttachments(
  current: readonly TaskAttachment[],
  incoming: readonly TaskAttachment[],
): TaskAttachment[] {
  const byId = new Map<string, TaskAttachment>();
  for (const attachment of [...current, ...incoming]) {
    const existing = byId.get(attachment.id);
    byId.set(
      attachment.id,
      existing ? { ...existing, ...attachment } : attachment,
    );
  }
  return [...byId.values()];
}

/** Files or links the server accepted, plus the audit row it wrote. */
export const withTaskAttachment =
  (result: AttachmentResult) =>
  (current: WorkspaceData): WorkspaceData =>
    withRecordedRows(result, {
      ...current,
      attachments: mergeTaskAttachments(current.attachments, [
        result.attachment,
      ]),
    });
