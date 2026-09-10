"use client";

import { useState } from "react";
import {
  Avatar,
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
import {
  errorMessage,
  formatFileSize,
  profileDisplayName,
} from "@/lib/presentation";
import type { Project, ResourceLink } from "@/lib/resources/resource-types";
import type { ResourceAttachmentDraft } from "@/lib/resources/resource-management";
import type { Profile } from "@/lib/workspace/workspace-types";
import {
  ResourceAttachments,
  ResourceLinks,
  ResourceLinksFields,
  useResourceAttachments,
} from "@/components/resources";

export type ProjectTeamGroup = {
  label: string;
  members: { profile: Profile }[];
  emptyMessage: string;
};

/**
 * How many entries a group shows before it folds.
 *
 * The card sits in a sticky column, so its natural height is the whole
 * viewport's budget. These caps are what keep a project with twenty links from
 * pushing the column past the fold; the rest is one click away rather than
 * gone, which matters because a reader without edit rights has no dialog to
 * open instead.
 */
const groupCaps = { members: 6, links: 6, notes: 3, files: 3 } as const;

function Subheading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
      {children}
    </p>
  );
}

function MoreButton({
  expanded,
  noun,
  onClick,
  total,
}: {
  expanded: boolean;
  noun: string;
  onClick: () => void;
  total: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 cursor-pointer text-xs font-semibold text-black/55 underline decoration-black/25 underline-offset-2 transition hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:text-white/55 dark:decoration-white/25 dark:hover:text-white dark:focus-visible:ring-white/40"
    >
      {expanded ? "Show fewer" : `Show all ${total} ${noun}`}
    </button>
  );
}

/**
 * A group inside the card: a subheading, a capped list, and the control that
 * unfolds the rest.
 */
function DetailGroup<Item>({
  cap,
  emptyMessage,
  items,
  label,
  noun,
  render,
}: {
  cap: number;
  emptyMessage: string;
  items: Item[];
  label: string;
  noun: string;
  /** Draws the whole list, so each group keeps its own list semantics. */
  render: (visible: Item[]) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, cap);

  return (
    <div>
      <Subheading>{label}</Subheading>
      {items.length ? (
        render(visible)
      ) : (
        <p className="text-xs text-black/45 dark:text-white/45">
          {emptyMessage}
        </p>
      )}
      {items.length > cap && (
        <MoreButton
          expanded={expanded}
          noun={noun}
          onClick={() => setExpanded(!expanded)}
          total={items.length}
        />
      )}
    </div>
  );
}

/**
 * Everything the overview says about a project besides its work: who is on it,
 * and the links, notes, and files that carry its context.
 *
 * These were three cards — dates, team, context — stacked in a sticky column
 * whose combined chrome cost about a third of its height and pushed the last
 * card below the fold. The dates moved into the page header, where the due
 * date already was, and what remains shares one card and one heading.
 *
 * The Edit button writes the links, notes, and files. The team is not editable
 * here at all: it is derived from the project's owners and its tasks'
 * assignees, so it reads as the record it is.
 */
export function ProjectDetailsCard({
  project,
  attachments,
  canEdit,
  demoMode,
  currentUserId,
  onLinksSaved,
  teamGroups,
  hasTeam,
  heading,
}: {
  project: Project;
  /** What the server rendered, so the lists paint before the client fetch. */
  attachments: ResourceAttachmentDraft[];
  canEdit: boolean;
  demoMode: boolean;
  currentUserId: string;
  onLinksSaved: (links: ResourceLink[]) => void;
  teamGroups: ProjectTeamGroup[];
  /** False when nobody owns the project and no task on it is assigned. */
  hasTeam: boolean;
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
  const emptyContext = !project.links.length && !notes.length && !files.length;

  return (
    <>
      <Card size="none" className="overflow-hidden">
        {heading(
          canEdit ? (
            <CardAction
              aria-label="Edit project links, notes, and files"
              onClick={() => setEditOpen(true)}
            >
              Edit
            </CardAction>
          ) : undefined,
        )}
        <div className="space-y-5 p-4 sm:p-5">
          {hasTeam ? (
            teamGroups.map((group) => (
              <DetailGroup
                key={group.label}
                cap={groupCaps.members}
                emptyMessage={group.emptyMessage}
                items={group.members}
                label={group.label}
                noun="people"
                render={(visible) => (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {visible.map(({ profile }) => (
                      <li key={profile.id} className="flex items-center gap-3">
                        <Avatar
                          name={profileDisplayName(profile)}
                          src={profile.avatar_url}
                          size="md"
                        />
                        <span className="min-w-0 truncate text-sm font-semibold">
                          {profileDisplayName(profile)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              />
            ))
          ) : (
            <div>
              <Subheading>Team</Subheading>
              <p className="text-xs text-black/45 dark:text-white/45">
                No project team assigned yet.
              </p>
            </div>
          )}
          {(project.links.length > 0 || canEdit) && (
            <DetailGroup
              cap={groupCaps.links}
              emptyMessage="No links yet."
              items={project.links}
              label="Links"
              noun="links"
              render={(visible) => <ResourceLinks links={visible} />}
            />
          )}
          {(notes.length > 0 || canEdit) && (
            <DetailGroup
              cap={groupCaps.notes}
              emptyMessage="No notes yet."
              items={notes}
              label="Notes"
              noun="notes"
              render={(visible) => (
                <ul className="space-y-2">
                  {visible.map((note) => (
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
              )}
            />
          )}
          {(files.length > 0 || canEdit) && (
            <DetailGroup
              cap={groupCaps.files}
              emptyMessage="No files yet."
              items={files}
              label="Files"
              noun="files"
              render={(visible) => (
                <ul className="space-y-2">
                  {visible.map((file) => (
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
              )}
            />
          )}
          {emptyContext && !canEdit && (
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
