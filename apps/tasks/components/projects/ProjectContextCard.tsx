"use client";

import { useState } from "react";
import {
  Card,
  CardAction,
  EmptyState,
  FormattedText,
  Modal,
  ModalActions,
  toast,
} from "@ryanmeetup/ui";
import { FiExternalLink, FiFile, FiFileText } from "react-icons/fi";
import { mutate } from "@/lib/mutation-client";
import { errorMessage, formatFileSize } from "@/lib/presentation";
import type { Project, ResourceLink } from "@/lib/resources/resource-types";
import type { ResourceAttachmentDraft } from "@/lib/resources/resource-management";
import {
  ResourceAttachments,
  ResourceLinks,
  ResourceLinksFields,
  useResourceAttachments,
} from "@/components/resources";

/**
 * A project's links, notes, and files, edited where they are read.
 *
 * These used to ride along in the project editor behind a "Supporting details"
 * disclosure. The card reads them; one Edit button opens the dialog that writes
 * them. The two save models still differ — notes and files write the moment you
 * add them, links wait for the confirm — so the dialog says so rather than
 * splitting into a button per section, which read as three unrelated controls.
 */
export function ProjectContextCard({
  project,
  attachments,
  canEdit,
  demoMode,
  currentUserId,
  onLinksSaved,
  heading,
}: {
  project: Project;
  /** What the server rendered, so the lists paint before the client fetch. */
  attachments: ResourceAttachmentDraft[];
  canEdit: boolean;
  demoMode: boolean;
  currentUserId: string;
  onLinksSaved: (links: ResourceLink[]) => void;
  /**
   * The card's own section heading, so the page keeps its heading idiom. Taken
   * as a function because the Edit button belongs in that heading, and only
   * this card knows whether there is one.
   */
  heading: (action: React.ReactNode) => React.ReactNode;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  // Read-only mirror of the same list the dialog edits, so adding a note in the
  // dialog updates the card behind it without a reload.
  const controller = useResourceAttachments({
    kind: "project",
    resourceId: project.id,
    demoMode,
    currentUserId,
    initialItems: attachments,
  });
  const notes = controller.notes;
  const files = controller.files;
  const openNote = notes.find((note) => note.id === openNoteId) ?? null;
  const empty = !project.links.length && !notes.length && !files.length;

  const subheading = (title: string) => (
    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
      {title}
    </p>
  );

  return (
    <>
      <Card size="none" className="overflow-hidden">
        {heading(
          canEdit ? (
            <CardAction onClick={() => setEditOpen(true)}>Edit</CardAction>
          ) : undefined,
        )}
        <div className="space-y-5 p-4 sm:p-5">
          {(project.links.length > 0 || canEdit) && (
            <div>
              {subheading("Links")}
              {project.links.length > 0 ? (
                <ResourceLinks links={project.links} />
              ) : (
                <p className="text-xs text-black/45 dark:text-white/45">
                  No links yet.
                </p>
              )}
            </div>
          )}
          {(notes.length > 0 || canEdit) && (
            <div>
              {subheading("Notes")}
              {notes.length === 0 && (
                <p className="text-xs text-black/45 dark:text-white/45">
                  No notes yet.
                </p>
              )}
              <ul className="space-y-2">
                {notes.map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => setOpenNoteId(note.id)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-black/10 p-3 text-left text-sm transition hover:bg-black/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:hover:bg-white/[0.04] dark:focus-visible:ring-white/40"
                    >
                      <FiFileText aria-hidden className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {note.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(files.length > 0 || canEdit) && (
            <div>
              {subheading("Files")}
              {files.length === 0 && (
                <p className="text-xs text-black/45 dark:text-white/45">
                  No files yet.
                </p>
              )}
              <ul className="space-y-2">
                {files.map((file) => (
                  <li key={file.id}>
                    <a
                      href={file.url || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={!file.url || undefined}
                      className={`flex items-center gap-3 rounded-xl border border-black/10 p-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:focus-visible:ring-white/40 ${file.url ? "hover:bg-black/[0.035] dark:hover:bg-white/[0.04]" : "pointer-events-none opacity-55"}`}
                    >
                      <FiFile aria-hidden className="shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {file.name}
                        </span>
                        <span className="block text-xs text-black/50 dark:text-white/50">
                          {formatFileSize(file.size_bytes) || "File"}
                        </span>
                      </span>
                      <FiExternalLink aria-hidden className="shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {empty && !canEdit && (
            <EmptyState
              variant="plain"
              message="No links, notes, or files on this project."
            />
          )}
        </div>
      </Card>

      {openNote && (
        <Modal
          open
          setIsOpen={(next) => {
            if (!next) setOpenNoteId(null);
          }}
          title={openNote.name}
          size="lg"
          dismissOnOutsideClick
        >
          <FormattedText
            text={openNote.body ?? ""}
            className="text-sm text-black/70 dark:text-white/70"
          />
        </Modal>
      )}

      {editOpen && (
        <ProjectContextDialog
          project={project}
          attachments={attachments}
          demoMode={demoMode}
          currentUserId={currentUserId}
          onClose={() => setEditOpen(false)}
          onLinksSaved={onLinksSaved}
        />
      )}
    </>
  );
}

/**
 * Links are a column on the project row, so unlike notes and files they need a
 * commit — hence a confirm that speaks only for them. Kept out of the project
 * settings form, which is what made that form long enough to scroll.
 */
function ProjectContextDialog({
  project,
  attachments,
  demoMode,
  currentUserId,
  onClose,
  onLinksSaved,
}: {
  project: Project;
  attachments: ResourceAttachmentDraft[];
  demoMode: boolean;
  currentUserId: string;
  onClose: () => void;
  onLinksSaved: (links: ResourceLink[]) => void;
}) {
  const [links, setLinks] = useState<ResourceLink[]>(project.links ?? []);
  const [saving, setSaving] = useState(false);
  const changed = JSON.stringify(links) !== JSON.stringify(project.links ?? []);

  // Older data may predate the editor's required label and address fields.
  // Keep the project save boundary strict even though new drafts cannot leave
  // their focused editor until both values are present.
  const incomplete = links.some(
    (link) => !link.label.trim() || !link.url.trim(),
  );

  async function save() {
    if (incomplete) {
      toast.error("Give every link a label and address, or remove it.");
      return;
    }
    setSaving(true);
    try {
      if (!demoMode)
        await mutate("/api/projects", {
          method: "PATCH",
          body: JSON.stringify({ id: project.id, links }),
        });
      onLinksSaved(links);
      toast.success("Project links saved.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "The links could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      setIsOpen={(next) => {
        if (!next && !saving) onClose();
      }}
      title="Project context"
      description="Link changes save when you confirm. Notes and files save immediately."
      size="lg"
      actions={
        <ModalActions
          cancelLabel="Close"
          confirmDisabled={!changed || incomplete}
          confirmLabel="Save link changes"
          confirmTooltip={
            incomplete
              ? "Every link needs a label and address."
              : "Change a link before saving."
          }
          onCancel={onClose}
          onConfirm={() => void save()}
          pending={saving}
          pendingLabel="Saving..."
        />
      }
    >
      <div className="space-y-4">
        <ResourceLinksFields
          links={links}
          setLinks={setLinks}
          disabled={saving}
          namePrefix={`project-${project.id}`}
        />
        <ResourceAttachments
          resource={{ kind: "project", id: project.id }}
          editor={{ demoMode, disabled: saving, currentUserId }}
          initialItems={attachments}
        />
      </div>
    </Modal>
  );
}
