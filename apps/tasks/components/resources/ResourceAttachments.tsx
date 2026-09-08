"use client";

import { useState } from "react";
import { Button } from "@ryanmeetup/ui";
import { FiPlus } from "react-icons/fi";
import { CountBadge } from "@/components/global";
import type { ResourceAttachmentDraft } from "@/lib/resources/resource-management";
import { AttachmentList } from "./AttachmentList";
import { AttachmentNoteEditor } from "./AttachmentNoteEditor";
import { AttachmentUploadControl } from "./AttachmentUploadControl";
import { useResourceAttachments } from "./useResourceAttachments";

export function ResourceAttachments({
  resource,
  editor,
  draftState,
  initialItems,
  onMutation,
}: {
  resource: { kind: "project" | "category"; id?: string };
  editor: { demoMode: boolean; disabled: boolean; currentUserId: string };
  draftState?: {
    drafts: ResourceAttachmentDraft[];
    onChange: (drafts: ResourceAttachmentDraft[]) => void;
  };
  /** Server-rendered list to show until this view's own fetch lands. */
  initialItems?: ResourceAttachmentDraft[];
  onMutation?: () => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [editingNote, setEditingNote] =
    useState<ResourceAttachmentDraft | null>(null);
  const controller = useResourceAttachments({
    kind: resource.kind,
    resourceId: resource.id,
    demoMode: editor.demoMode,
    currentUserId: editor.currentUserId,
    draftState,
    initialItems,
    onMutation,
  });
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-black/10 bg-black/[0.015] p-4 dark:border-white/10 dark:bg-white/[0.025]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Notes</h3>
              {controller.notes.length > 0 && (
                <CountBadge>{controller.notes.length}</CountBadge>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-black/55 dark:text-white/55">
              Keep useful context with the {resource.kind}.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<FiPlus aria-hidden />}
            className="w-full shrink-0 !normal-case tracking-normal sm:w-auto"
            disabled={
              editor.disabled ||
              controller.saving ||
              noteOpen ||
              Boolean(editingNote)
            }
            onClick={() => {
              setEditingNote(null);
              setNoteOpen(true);
            }}
          >
            Add note
          </Button>
        </div>
        <div
          className={
            noteOpen ||
            editingNote ||
            controller.notes.length ||
            controller.loading
              ? "mt-4"
              : undefined
          }
        >
          {noteOpen && (
            <AttachmentNoteEditor
              kind={resource.kind}
              resourceId={resource.id}
              saving={controller.saving}
              onCancel={() => setNoteOpen(false)}
              onSave={async (title, body) => {
                await controller.addNote(title, body);
                setNoteOpen(false);
              }}
            />
          )}
          {editingNote && (
            <AttachmentNoteEditor
              key={editingNote.id}
              kind={resource.kind}
              resourceId={resource.id}
              saving={controller.saving}
              initialTitle={editingNote.name}
              initialBody={editingNote.body ?? ""}
              submitLabel="Update note"
              onCancel={() => setEditingNote(null)}
              onSave={async (title, body) => {
                await controller.updateNote(editingNote, title, body);
                setEditingNote(null);
              }}
            />
          )}
          <AttachmentList
            items={
              editingNote
                ? controller.notes.filter((note) => note.id !== editingNote.id)
                : controller.notes
            }
            type="note"
            loading={controller.loading}
            disabled={
              editor.disabled ||
              controller.saving ||
              noteOpen ||
              Boolean(editingNote)
            }
            onEdit={(item) => {
              setNoteOpen(false);
              setEditingNote(item);
            }}
            onRemove={(item) => void controller.remove(item)}
            onReorder={(item, targetId, edge) =>
              void controller.move(item, targetId, edge)
            }
          />
        </div>
      </section>
      <section className="rounded-xl border border-black/10 bg-black/[0.015] p-4 dark:border-white/10 dark:bg-white/[0.025]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Attachments</h3>
              {controller.files.length > 0 && (
                <CountBadge>{controller.files.length}</CountBadge>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-black/55 dark:text-white/55">
              Add photos, PDFs, or text files. 10 MB maximum per file.
            </p>
          </div>
          <div className="w-full shrink-0 sm:w-auto">
            <AttachmentUploadControl
              kind={resource.kind}
              disabled={editor.disabled}
              saving={controller.saving}
              onFiles={(files) => void controller.uploadFiles(files)}
            />
          </div>
        </div>
        <div
          className={
            controller.files.length || controller.loading ? "mt-4" : undefined
          }
        >
          <AttachmentList
            items={controller.files}
            type="file"
            loading={controller.loading}
            disabled={editor.disabled || controller.saving}
            onRemove={(item) => void controller.remove(item)}
            onReorder={(item, targetId, edge) =>
              void controller.move(item, targetId, edge)
            }
          />
        </div>
      </section>
    </div>
  );
}
