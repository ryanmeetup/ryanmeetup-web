"use client";

import {
  Avatar,
  Button,
  DropdownSelect,
  getFieldLabelClasses,
  Input,
  ModalActions,
  Textarea,
} from "@ryanmeetup/ui";
import { EditorSurface } from "@/components/global";
import { FiCalendar, FiTrash2 } from "react-icons/fi";
import {
  workspaceTimeZoneLabel,
  type CalendarEventKind,
} from "@/lib/calendar/calendar-types";
import { profileDisplayName } from "@/lib/presentation";
import { isClosedProjectStatus } from "@/lib/resources/project-status";
import type { Category, Project } from "@/lib/resources/resource-types";
import type { Profile } from "@/lib/workspace/workspace-types";
import { CalendarRecurrenceFields } from "./CalendarRecurrenceFields";
import type { useCalendarEventEditor } from "./useCalendarEventEditor";

type CalendarEventEditorProps = {
  categories: Category[];
  currentProfileId: string;
  editor: ReturnType<typeof useCalendarEventEditor>;
  googleEmail?: string;
  googleSyncAvailable: boolean;
  previewing: boolean;
  profiles: Profile[];
  projects: Project[];
} & (
  | { presentation?: "modal" }
  /** The dedicated route. See `docs/MOBILE_EDITOR_SURFACES.md`. */
  | { presentation: "page" }
);

export function CalendarEventEditorModal(props: CalendarEventEditorProps) {
  const {
    categories,
    currentProfileId,
    editor,
    googleEmail,
    googleSyncAvailable,
    previewing,
    profiles,
    projects,
  } = props;
  const {
    canEdit,
    changeKind,
    deleting,
    draft,
    editingEvent,
    recurrenceConflict,
    saving,
    setDraft,
    updateDraft,
  } = editor;
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  const noun = draft?.kind === "away" ? "time away" : "important date";
  const surface =
    props.presentation === "page"
      ? ({
          presentation: "page",
          parents: [
            {
              href: "/calendar",
              title: "Calendar",
              icon: <FiCalendar aria-hidden className="shrink-0" />,
            },
          ],
          crumb: { title: draft?.id ? draft.title || noun : `New ${noun}` },
        } as const)
      : ({ presentation: "modal" } as const);

  return (
    <EditorSurface
      {...surface}
      open={Boolean(draft)}
      setOpen={(open) => {
        if (!open && !saving) setDraft(null);
      }}
      title={draft?.id ? `Edit ${noun}` : "Add to calendar"}
      description={
        draft?.kind === "away"
          ? "Let the team know when you will be unreachable."
          : "Add a milestone, event, or important date that is not a task deadline."
      }
      formId="calendar-event-form"
      onSubmit={editor.save}
      closable={!saving}
      supportingActions={
        draft?.id && canEdit ? (
          <Button
            variant="danger"
            size="sm"
            leftIcon={<FiTrash2 />}
            loading={deleting}
            onClick={editor.remove}
          >
            Delete
          </Button>
        ) : undefined
      }
      actions={
        draft ? (
          <ModalActions
            confirmDisabled={
              !canEdit ||
              !draft.title.trim() ||
              draft.endDate < draft.startDate ||
              Boolean(recurrenceConflict) ||
              (draft.kind === "away" && !draft.profileId)
            }
            confirmForm="calendar-event-form"
            confirmLabel="Save"
            onCancel={() => setDraft(null)}
            pending={saving}
            pendingLabel="Saving..."
          />
        ) : undefined
      }
    >
      {draft && (
        <div className="space-y-5">
          {!canEdit && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              {previewing ? (
                "Access preview is read-only. Exit the preview to change calendar items."
              ) : (
                <>
                  This was logged by{" "}
                  {profileDisplayName(
                    profileMap.get(editingEvent?.created_by ?? ""),
                  )}
                  . Only that teammate, the person who is away, or an app owner
                  can change it.
                </>
              )}
            </div>
          )}
          {!draft.id && canEdit && (
            <DropdownSelect
              variant="field"
              required
              label="What are you adding?"
              value={draft.kind}
              onChange={(value) => changeKind(value as CalendarEventKind)}
              options={[
                { label: "Important date", value: "important" },
                { label: "Time away", value: "away" },
              ]}
            />
          )}
          {draft.kind === "away" &&
            (canEdit ? (
              <DropdownSelect
                variant="field"
                required
                label="Who will be away?"
                proximityValue={currentProfileId}
                value={draft.profileId}
                onChange={(value) => updateDraft("profileId", value)}
                options={profiles
                  .filter((profile) => profile.onboarding_completed)
                  .map((profile) => ({
                    avatar: {
                      name: profileDisplayName(profile),
                      src: profile.avatar_url,
                    },
                    label: profileDisplayName(profile),
                    value: profile.id,
                  }))}
              />
            ) : (
              <div>
                <p className={getFieldLabelClasses()}>Who will be away?</p>
                <p className="mt-2 flex items-center gap-2 text-sm">
                  <Avatar
                    name={profileDisplayName(profileMap.get(draft.profileId))}
                    src={profileMap.get(draft.profileId)?.avatar_url}
                    size="sm"
                  />
                  {profileDisplayName(profileMap.get(draft.profileId))}
                </p>
              </div>
            ))}
          <Input
            label="Title"
            name="calendar-title"
            required
            value={draft.title}
            disabled={!canEdit || saving}
            placeholder={
              draft.kind === "away" ? "Out of office" : "What is happening?"
            }
            onChange={(event) => updateDraft("title", event.target.value)}
          />
          <Textarea
            id="calendar-description"
            label="Details"
            name="calendar-description"
            value={draft.description}
            disabled={!canEdit || saving}
            rows={3}
            placeholder="Add the context your teammates will need."
            onChange={(event) => updateDraft("description", event.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="date"
              label="Start date"
              name="calendar-start-date"
              required
              value={draft.startDate}
              disabled={!canEdit || saving}
              onChange={(event) => updateDraft("startDate", event.target.value)}
            />
            <Input
              type="date"
              label="End date"
              name="calendar-end-date"
              required
              min={draft.startDate}
              value={draft.endDate}
              disabled={!canEdit || saving}
              onChange={(event) => updateDraft("endDate", event.target.value)}
            />
          </div>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={draft.allDay}
              disabled={!canEdit || saving}
              onChange={(event) => updateDraft("allDay", event.target.checked)}
              className="h-4 w-4 rounded border-black/30 accent-black dark:border-white/30 dark:accent-white"
            />
            All day
          </label>
          {!draft.allDay && (
            <div className="space-y-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  type="time"
                  label="Start time"
                  name="calendar-start-time"
                  required
                  value={draft.startTime}
                  disabled={!canEdit || saving}
                  onChange={(event) =>
                    updateDraft("startTime", event.target.value)
                  }
                />
                <Input
                  type="time"
                  label="End time"
                  name="calendar-end-time"
                  required
                  value={draft.endTime}
                  disabled={!canEdit || saving}
                  onChange={(event) =>
                    updateDraft("endTime", event.target.value)
                  }
                />
              </div>
              <p className="text-xs text-black/55 dark:text-white/55">
                Saved in {workspaceTimeZoneLabel(draft.startDate, "long")}, and
                shown that way to every teammate.
              </p>
            </div>
          )}
          <CalendarRecurrenceFields
            key={draft.id ?? "new"}
            startDate={draft.startDate}
            endDate={draft.endDate}
            value={draft.recurrence}
            disabled={!canEdit || saving}
            onChange={(recurrence) => updateDraft("recurrence", recurrence)}
          />
          {Boolean(draft.id) && Boolean(draft.recurrence) && (
            <p className="text-xs text-black/60 dark:text-white/60">
              Every date in this series shares one entry, so an edit here
              changes all of them.
            </p>
          )}
          {draft.kind === "important" && (
            <DropdownSelect
              variant="field"
              required
              label="Visibility"
              value={
                draft.projectId
                  ? `project:${draft.projectId}`
                  : draft.categoryId
                    ? `category:${draft.categoryId}`
                    : "workspace"
              }
              onChange={(value) => {
                const [kind, id] = value.split(":");
                updateDraft("projectId", kind === "project" ? id : "");
                updateDraft("categoryId", kind === "category" ? id : "");
              }}
              options={[
                { label: "Everyone in the workspace", value: "workspace" },
                ...projects
                  .filter((project) => !isClosedProjectStatus(project.status))
                  .map((project) => ({
                    label: project.name,
                    value: `project:${project.id}`,
                    group: { label: "Projects" },
                  })),
                ...categories
                  .filter((category) => !category.archived_at)
                  .map((category) => ({
                    label: category.name,
                    value: `category:${category.id}`,
                    color: category.color,
                    group: { label: "Categories" },
                  })),
              ]}
            />
          )}
          {googleSyncAvailable && (
            <label className="flex items-start gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={draft.syncToGoogle}
                disabled={!canEdit || saving}
                onChange={(event) =>
                  updateDraft("syncToGoogle", event.target.checked)
                }
                className="mt-0.5 h-4 w-4 rounded border-black/30 accent-black dark:border-white/30 dark:accent-white"
              />
              <span>
                Add to the workspace Google Calendar
                <span className="mt-1 block text-xs font-normal text-black/70 dark:text-white/70">
                  {googleEmail
                    ? `Saves a copy on ${googleEmail}, visible to everyone who can see the shared calendar.`
                    : "Saves a copy on the shared calendar, visible to everyone who can see it."}
                </span>
              </span>
            </label>
          )}
        </div>
      )}
    </EditorSurface>
  );
}
