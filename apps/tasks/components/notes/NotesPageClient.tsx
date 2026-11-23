"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryParamState, useSearchFilter } from "@ryanmeetup/hooks";
import {
  Button,
  ConfirmationDialog,
  DropdownSelect,
  EmptyState,
  ManagementSurface,
  PendingResults,
  SearchInput,
  toast,
} from "@ryanmeetup/ui";
import { FiArchive, FiFileText, FiPlus, FiSearch, FiX } from "react-icons/fi";
import {
  CountBadge,
  editorTriggers,
  ResponsiveTable,
  WorkspacePageShell,
} from "@/components/global";
import { NewTaskModal } from "@/components/tasks";
import { ProjectsModal } from "@/components/projects";
import {
  filterNotes,
  groupNotesByCategory,
  linkNoteToProject,
  noteConversionDraft,
  noteConversionProjectDraft,
  noteTitle,
} from "@/lib/resources/notes";
import type {
  Note,
  NoteComment,
  Project,
} from "@/lib/resources/resource-types";
import type { Task } from "@/lib/tasks/task-types";
import { taskPath } from "@/lib/tasks/task-key";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { mutate } from "@/lib/mutation-client";
import { archiveFilter } from "@/lib/resources/resource-management";
import { NoteRow, noteColumns } from "./NoteRow";
import { NoteModal } from "./NoteModal";
import { saveNoteDraft } from "./note-requests";
import { NewNoteModal, type NewNoteDraft } from "./NewNoteModal";
import { errorMessage } from "@/lib/presentation";
export function NotesPageClient({
  initialData,
  initialNotes,
  initialComments,
  demoMode,
}: {
  initialData: WorkspaceData;
  initialNotes: Note[];
  initialComments: NoteComment[];
  demoMode: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [notes, setNotes] = useState(initialNotes);
  const [comments, setComments] = useState(initialComments);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);
  const [noteStatusParam, setNoteStatus] = useQueryParamState(
    "note-status",
    "active",
  );
  const [noteCategoryParam, setNoteCategory] = useQueryParamState(
    "note-category",
    "all",
  );
  const showArchived = archiveFilter(noteStatusParam) === "archived";
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [convertTarget, setConvertTarget] = useState<Note | null>(null);
  const [convertProjectTarget, setConvertProjectTarget] = useState<Note | null>(
    null,
  );
  const triggers = editorTriggers(data.currentProfile.editor_surface);
  const canConvertToProject =
    demoMode || data.currentProfile.app_role === "owner";

  async function createNote({ title, body, categoryId }: NewNoteDraft) {
    if (!title.trim() || !body.trim()) return false;
    try {
      const note: Note = demoMode
        ? {
            id: crypto.randomUUID(),
            title: title.trim(),
            body: body.trim(),
            created_by: data.currentProfile.id,
            category_id: categoryId || null,
            converted_task_id: null,
            converted_project_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            archived_at: null,
          }
        : (
            await mutate<{ note: Note }>("/api/notes", {
              method: "POST",
              body: JSON.stringify({ title, body, categoryId }),
            })
          ).note;
      setNotes((current) => [note, ...current]);
      toast.success("Note saved.");
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "The note could not be saved."));
      return false;
    }
  }

  async function saveNote(note: Note, title: string, body: string) {
    try {
      const updated = await saveNoteDraft(note, title, body, demoMode);
      setNotes((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success("Note saved.");
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "The note could not be saved."));
      return false;
    }
  }

  function toggleArchived(note: Note) {
    void updateNote({
      ...note,
      archived_at: note.archived_at ? null : new Date().toISOString(),
    });
  }

  async function updateNote(next: Note) {
    const previous = notes.find((item) => item.id === next.id);
    setNotes((current) =>
      current.map((item) => (item.id === next.id ? next : item)),
    );
    if (demoMode || previous?.archived_at === next.archived_at) return;
    try {
      const result = await mutate<{ note: Note }>("/api/notes", {
        method: "PATCH",
        body: JSON.stringify({
          id: next.id,
          archived: Boolean(next.archived_at),
        }),
      });
      setNotes((current) =>
        current.map((item) => (item.id === next.id ? result.note : item)),
      );
      toast.success(next.archived_at ? "Note archived." : "Note restored.");
    } catch (error) {
      if (previous)
        setNotes((current) =>
          current.map((item) => (item.id === next.id ? previous : item)),
        );
      toast.error(errorMessage(error, "The note could not be updated."));
    }
  }

  async function deleteNote() {
    if (!deleteTarget) return;
    try {
      if (!demoMode)
        await mutate("/api/notes", {
          method: "DELETE",
          body: JSON.stringify({ id: deleteTarget.id }),
        });
      setNotes((current) =>
        current.filter((note) => note.id !== deleteTarget.id),
      );
      setComments((current) =>
        current.filter((comment) => comment.note_id !== deleteTarget.id),
      );
      setDeleteTarget(null);
      toast.success("Note deleted.");
    } catch (error) {
      toast.error(errorMessage(error, "The note could not be deleted."));
    }
  }

  const openNote = notes.find((note) => note.id === openNoteId) ?? null;
  const activeNotes = filterNotes(notes, showArchived);
  const noteGroups = groupNotesByCategory(activeNotes, data.categories);
  const selectedGroup = noteGroups.find((group) => {
    if (!group.category) return noteCategoryParam === "uncategorized";
    return (
      group.category.name === noteCategoryParam ||
      group.category.id === noteCategoryParam
    );
  });
  const categoryNotes =
    noteCategoryParam === "all" ? activeNotes : (selectedGroup?.notes ?? []);
  const authorNames = new Map(
    data.profiles.map((profile) => [profile.id, profile.full_name ?? ""]),
  );
  // Keep the placeholder in step with these fields.
  const {
    query,
    setQuery,
    filtered: visibleNotes,
    isPending: searchPending,
  } = useSearchFilter({
    data: categoryNotes,
    buildHaystack: (note: Note) =>
      [noteTitle(note), note.body, authorNames.get(note.created_by ?? "") ?? ""]
        .join(" ")
        .toLowerCase(),
    queryParam: "note-search",
  });
  const conversionDraft = convertTarget
    ? noteConversionDraft(convertTarget, data.statuses, data.currentProfile.id)
    : null;

  async function markConverted(task: Task) {
    if (!convertTarget) return;
    const convertedNote = convertTarget;
    try {
      if (!demoMode)
        await mutate("/api/notes", {
          method: "DELETE",
          body: JSON.stringify({ id: convertedNote.id }),
        });
      setNotes((current) =>
        current.filter((note) => note.id !== convertedNote.id),
      );
      setComments((current) =>
        current.filter((comment) => comment.note_id !== convertedNote.id),
      );
      toast.success("Note converted to a task and deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `The task was created, but the note could not be deleted: ${error.message}`
          : "The task was created, but the note could not be deleted.",
      );
    } finally {
      setConvertTarget(null);
      router.push(taskPath(task));
    }
  }

  const projectConversionDraft = convertProjectTarget
    ? noteConversionProjectDraft(convertProjectTarget)
    : null;

  async function markConvertedProject(project: Project) {
    if (!convertProjectTarget) return;
    try {
      const updated = demoMode
        ? linkNoteToProject(convertProjectTarget, project)
        : (
            await mutate<{ note: Note }>("/api/notes", {
              method: "PATCH",
              body: JSON.stringify({
                id: convertProjectTarget.id,
                convertedProjectId: project.id,
              }),
            })
          ).note;
      setNotes((current) =>
        current.map((note) => (note.id === updated.id ? updated : note)),
      );
      toast.success("Note converted to a project.");
    } catch {
      toast.error(
        "The project was created, but the note could not be linked to it.",
      );
    } finally {
      setConvertProjectTarget(null);
    }
  }

  return (
    <>
      <WorkspacePageShell
        data={data}
        setData={setData}
        demoMode={demoMode}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        contentClassName="p-3 sm:p-6 lg:p-6 xl:p-8"
      >
        <ManagementSurface
          title={
            <>
              Notes <CountBadge size="lg">{activeNotes.length}</CountBadge>
            </>
          }
          description="Catch quick thoughts before they escape. When an idea becomes real work, turn it into a task."
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() =>
                  setNoteStatus(showArchived ? "active" : "archived")
                }
              >
                {showArchived ? "View active" : "View archive"}
              </Button>
              <Button
                type="button"
                size="sm"
                className="w-full sm:w-auto"
                leftIcon={<FiPlus aria-hidden />}
                onClick={() => setCreatingNote(true)}
              >
                New note
              </Button>
            </div>
          }
        >
          <section
            className="@container"
            aria-label={showArchived ? "Archived notes" : "Notes"}
          >
            {/* Only the archive needs saying; the page title already names active notes. */}
            {showArchived && (
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-caps">
                Archived notes
              </h2>
            )}

            {activeNotes.length ? (
              <div>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <SearchInput
                      label="Search notes"
                      name="note-search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search by title, details, or author..."
                      pending={searchPending}
                      pendingLabel="Loading note results"
                    />
                  </div>
                  <DropdownSelect
                    label="Category"
                    active={noteCategoryParam !== "all"}
                    value={
                      selectedGroup
                        ? (selectedGroup.category?.name ?? "uncategorized")
                        : "all"
                    }
                    onChange={setNoteCategory}
                    options={[
                      {
                        label: `All categories (${activeNotes.length})`,
                        value: "all",
                      },
                      ...noteGroups.map((group) => ({
                        label: `${group.category?.name ?? "Uncategorized"} (${group.notes.length})`,
                        value: group.category?.name ?? "uncategorized",
                        color: group.category?.color ?? "#8a8a8a",
                      })),
                    ]}
                  />
                </div>

                <PendingResults pending={searchPending} label="Loading notes">
                  {visibleNotes.length ? (
                    <ResponsiveTable
                      caption={showArchived ? "Archived notes" : "Notes"}
                      columns={noteColumns}
                      layout="auto"
                    >
                      {visibleNotes.map((note) => (
                        <NoteRow
                          key={note.id}
                          note={note}
                          category={
                            data.categories.find(
                              (category) => category.id === note.category_id,
                            ) ?? null
                          }
                          profiles={data.profiles}
                          canConvertToProject={canConvertToProject}
                          commentCount={
                            comments.filter(
                              (comment) => comment.note_id === note.id,
                            ).length
                          }
                          convertedTask={data.tasks.find(
                            (task) => task.id === note.converted_task_id,
                          )}
                          convertedProject={data.projects.find(
                            (project) =>
                              project.id === note.converted_project_id,
                          )}
                          onOpen={(next) => {
                            setEditingNote(false);
                            setOpenNoteId(next.id);
                          }}
                          onEdit={(next) => {
                            setEditingNote(true);
                            setOpenNoteId(next.id);
                          }}
                          onArchive={toggleArchived}
                          onConvert={setConvertTarget}
                          onConvertToProject={setConvertProjectTarget}
                          onDelete={setDeleteTarget}
                          triggers={triggers}
                        />
                      ))}
                    </ResponsiveTable>
                  ) : (
                    <EmptyState
                      icon={<FiSearch />}
                      message="No notes match"
                      description="Try another phrase or category, or clear your filters to see all notes."
                      action={
                        <Button
                          size="sm"
                          variant="secondary"
                          leftIcon={<FiX aria-hidden />}
                          onClick={() => {
                            setQuery("");
                            setNoteCategory("all");
                          }}
                        >
                          View all notes
                        </Button>
                      }
                    />
                  )}
                </PendingResults>
              </div>
            ) : (
              <EmptyState
                icon={showArchived ? <FiArchive /> : <FiFileText />}
                message={
                  showArchived ? "Nothing archived" : "No loose thoughts yet"
                }
                description={
                  showArchived
                    ? "Archived notes will wait here."
                    : "Capture an idea now. Turn it into a task or project when it’s ready."
                }
                action={
                  showArchived ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<FiFileText aria-hidden />}
                      onClick={() => setNoteStatus("active")}
                    >
                      View active notes
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      leftIcon={<FiPlus aria-hidden />}
                      onClick={() => setCreatingNote(true)}
                    >
                      New note
                    </Button>
                  )
                }
              />
            )}
          </section>
        </ManagementSurface>
      </WorkspacePageShell>

      {openNote && (
        <NoteModal
          key={openNote.id}
          note={openNote}
          category={
            data.categories.find(
              (category) => category.id === openNote.category_id,
            ) ?? null
          }
          profiles={data.profiles}
          demoMode={demoMode}
          editing={editingNote && !openNote.archived_at}
          setEditing={setEditingNote}
          convertedTask={data.tasks.find(
            (task) => task.id === openNote.converted_task_id,
          )}
          convertedProject={data.projects.find(
            (project) => project.id === openNote.converted_project_id,
          )}
          comments={comments.filter(
            (comment) => comment.note_id === openNote.id,
          )}
          currentProfileId={data.currentProfile.id}
          onCommentsChange={(next) =>
            setComments((current) => [
              ...current.filter((comment) => comment.note_id !== openNote.id),
              ...next,
            ])
          }
          onSave={(title, body) => saveNote(openNote, title, body)}
          onClose={() => {
            setEditingNote(false);
            setOpenNoteId(null);
          }}
        />
      )}

      <NewNoteModal
        open={creatingNote}
        setOpen={setCreatingNote}
        categories={data.categories}
        onCreate={createNote}
      />

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        setOpen={(open) => !open && setDeleteTarget(null)}
        title="Delete this note?"
        description="This permanently removes the shared note. This cannot be undone."
        confirmLabel="Delete note"
        destructive
        onConfirm={() => void deleteNote()}
      />

      {convertTarget && conversionDraft && (
        <NewTaskModal
          key={convertTarget.id}
          data={data}
          setData={setData}
          demoMode={demoMode}
          open
          setOpen={(open) => !open && setConvertTarget(null)}
          initialDraft={conversionDraft}
          onCreated={markConverted}
        />
      )}

      {convertProjectTarget && projectConversionDraft && (
        <ProjectsModal
          key={convertProjectTarget.id}
          modal={{
            open: true,
            setOpen: (open) => !open && setConvertProjectTarget(null),
          }}
          workspace={{ data, setData, demoMode }}
          options={{ createOnly: true, initialDraft: projectConversionDraft }}
          events={{ onCreated: markConvertedProject }}
        />
      )}
    </>
  );
}
