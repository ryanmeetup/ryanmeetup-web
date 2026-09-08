"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@ryanmeetup/ui";
import { MAX_ATTACHMENT_SIZE } from "@/lib/tasks/task-attachments";
import { errorMessage } from "@/lib/presentation";
import type { ResourceAttachment } from "@/lib/resources/resource-types";
import type { ResourceAttachmentDraft } from "@/lib/resources/resource-management";
import {
  publishResourceAttachmentsChanged,
  resourceAttachmentsAffected,
  subscribeToResourceAttachments,
} from "@/lib/resources/resource-attachment-events";
import {
  appendAttachmentDraft,
  createFileDraft,
  createNoteDraft,
  moveAttachmentDraft,
  partitionAttachmentDrafts,
  removeAttachmentDraft,
  type ResourceKind,
} from "@/lib/resources/resource-attachment-drafts";

export function useResourceAttachments({
  kind,
  resourceId,
  demoMode,
  currentUserId,
  draftState,
  initialItems,
  onMutation,
}: {
  kind: ResourceKind;
  resourceId?: string;
  demoMode: boolean;
  currentUserId: string;
  /**
   * What the server already rendered, so a view that was handed the list does
   * not blank out and refill while its own fetch runs. The fetch still happens
   * and still wins; this only decides what is on screen until it lands.
   */
  initialItems?: ResourceAttachmentDraft[];
  draftState?: {
    drafts: ResourceAttachmentDraft[];
    onChange: (drafts: ResourceAttachmentDraft[]) => void;
  };
  onMutation?: () => void;
}) {
  const idKey = kind === "category" ? "categoryId" : "projectId";
  const endpoint = `/api/${kind}-attachments`;
  const [items, setItems] = useState<ResourceAttachmentDraft[]>(
    draftState?.drafts ?? initialItems ?? [],
  );
  // Which resource the items on hand were fetched for. Tracking this instead of
  // a loading flag keeps the pending state derived: this view outlives the
  // resource it points at - the board header stays mounted while you move
  // between projects - and a flag set once at mount would report every later
  // resource as loaded before its fetch had even started.
  const [loadedResourceId, setLoadedResourceId] = useState<string>();
  const [saving, setSaving] = useState(false);
  // Identifies this view on the change bus so it skips its own writes.
  const origin = useMemo(() => ({}), []);
  // Held in a ref so reloading does not depend on the caller's draft handler,
  // which is a fresh function on every render.
  const notifyDrafts = useRef(draftState?.onChange);
  useEffect(() => {
    notifyDrafts.current = draftState?.onChange;
  });

  const updateItems = useCallback(
    (
      update: (current: ResourceAttachmentDraft[]) => ResourceAttachmentDraft[],
    ) => {
      setItems((current) => {
        const next = update(current);
        notifyDrafts.current?.(next);
        return next;
      });
    },
    [],
  );

  const load = useCallback(
    async (signal: AbortSignal) => {
      if (demoMode || !resourceId) return;
      try {
        const response = await fetch(
          `${endpoint}?${idKey}=${encodeURIComponent(resourceId)}`,
          { signal },
        );
        const result = (await response.json()) as {
          attachments?: ResourceAttachment[];
          error?: string;
        };
        if (!response.ok) throw new Error(result.error);
        updateItems(() => result.attachments ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        toast.error(
          `${kind === "project" ? "Project" : "Category"} attachments could not be loaded.`,
        );
      } finally {
        // An aborted request was superseded by one for another resource, so it
        // must not mark anything loaded - the replacement will.
        if (!signal.aborted) setLoadedResourceId(resourceId);
      }
    },
    [demoMode, endpoint, idKey, kind, resourceId, updateItems],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /**
   * A write from another view of this resource — the edit modal opened over
   * the board, another tab, a teammate — has to reach this copy, or it keeps
   * showing what it fetched until the page is reloaded.
   */
  useEffect(() => {
    if (demoMode || !resourceId) return;
    const controller = new AbortController();
    const unsubscribe = subscribeToResourceAttachments((change) => {
      if (!resourceAttachmentsAffected(change, { kind, resourceId, origin }))
        return;
      void load(controller.signal);
    });
    return () => {
      unsubscribe();
      controller.abort();
    };
  }, [demoMode, kind, load, origin, resourceId]);

  /** Tells the other views of this resource to reload. */
  function announceChange() {
    onMutation?.();
    if (!demoMode && resourceId)
      publishResourceAttachmentsChanged({ kind, resourceId, origin });
  }

  async function addNote(name: string, body: string) {
    if (!name.trim() || !body.trim())
      throw new Error("Add a title and some text for the note.");
    setSaving(true);
    try {
      let attachment = createNoteDraft({
        kind,
        resourceId,
        currentUserId,
        name,
        body,
      });
      if (!demoMode && resourceId) {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            [idKey]: resourceId,
            name: name.trim(),
            body: body.trim(),
          }),
        });
        const result = (await response.json()) as {
          attachment?: ResourceAttachment;
          error?: string;
        };
        if (!response.ok || !result.attachment)
          throw new Error(result.error ?? "The note could not be attached.");
        attachment = result.attachment;
      }
      updateItems((current) => appendAttachmentDraft(current, attachment));
      announceChange();
      toast.success("Note attached.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0 || saving) return;
    setSaving(true);
    let uploaded = 0;
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        toast.error(`${file.name} is larger than the 10 MB limit.`);
        continue;
      }
      try {
        let attachment = createFileDraft({
          kind,
          resourceId,
          currentUserId,
          file,
          retainFile: !resourceId,
        });
        if (!demoMode && resourceId) {
          const formData = new FormData();
          formData.set(idKey, resourceId);
          formData.set("file", file);
          const response = await fetch(endpoint, {
            method: "POST",
            body: formData,
          });
          const result = (await response.json()) as {
            attachment?: ResourceAttachment;
            error?: string;
          };
          if (!response.ok || !result.attachment)
            throw new Error(result.error ?? "The upload was rejected.");
          attachment = result.attachment;
        }
        updateItems((current) => appendAttachmentDraft(current, attachment));
        announceChange();
        uploaded += 1;
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `${file.name}: ${error.message}`
            : `${file.name} could not be uploaded.`,
        );
      }
    }
    setSaving(false);
    if (uploaded)
      toast.success(
        `${uploaded} ${uploaded === 1 ? "file" : "files"} attached.`,
      );
  }

  async function remove(item: ResourceAttachmentDraft) {
    updateItems((current) => removeAttachmentDraft(current, item.id));
    if (demoMode || !resourceId) {
      announceChange();
      return;
    }
    try {
      const response = await fetch(
        `${endpoint}?id=${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error);
      announceChange();
    } catch (error) {
      updateItems((current) => appendAttachmentDraft(current, item));
      toast.error(errorMessage(error, "The attachment could not be removed."));
    }
  }

  async function move(
    item: ResourceAttachmentDraft,
    targetId: string | undefined,
    edge: "before" | "after",
  ) {
    const previous = items;
    const { drafts, sortOrder } = moveAttachmentDraft(
      items,
      item.id,
      targetId,
      edge,
    );
    updateItems(() => drafts);
    if (demoMode || !resourceId) {
      announceChange();
      return;
    }
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [idKey]: resourceId, id: item.id, sortOrder }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error);
      announceChange();
    } catch (error) {
      updateItems(() => previous);
      toast.error(
        errorMessage(error, "The attachment could not be reordered."),
      );
    }
  }

  async function updateNote(
    item: ResourceAttachmentDraft,
    name: string,
    body: string,
  ) {
    if (!name.trim() || !body.trim())
      throw new Error("Add a title and some text for the note.");
    const previous = items;
    const updated = { ...item, name: name.trim(), body: body.trim() };
    setSaving(true);
    updateItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? updated : candidate,
      ),
    );
    try {
      if (!demoMode && resourceId) {
        const response = await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            [idKey]: resourceId,
            id: item.id,
            name: updated.name,
            body: updated.body,
          }),
        });
        const result = (await response.json()) as {
          attachment?: ResourceAttachment;
          error?: string;
        };
        if (!response.ok || !result.attachment)
          throw new Error(result.error ?? "The note could not be updated.");
        updateItems((current) =>
          current.map((candidate) =>
            candidate.id === item.id ? result.attachment! : candidate,
          ),
        );
      }
      announceChange();
      toast.success("Note updated.");
    } catch (error) {
      updateItems(() => previous);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  return {
    ...partitionAttachmentDrafts(items),
    loading:
      !demoMode && Boolean(resourceId) && loadedResourceId !== resourceId,
    saving,
    addNote,
    updateNote,
    uploadFiles,
    remove,
    move,
  };
}
