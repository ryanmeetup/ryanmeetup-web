"use client";

import type { Dispatch, SetStateAction } from "react";
import { FiLock } from "react-icons/fi";
import {
  DropdownSelect,
  getFieldLabelClasses,
  Input,
  MultiSelect,
  RichTextarea,
  Textarea,
  Tooltip,
} from "@ryanmeetup/ui";
import type { Category, Project } from "@/lib/resources/resource-types";
import type { Priority, Status } from "@/lib/tasks/task-types";
import type { Profile } from "@/lib/workspace/workspace-types";
import type { TaskDraft } from "@/lib/tasks/task-mutations";
import { profileDisplayName } from "@/lib/presentation";
import {
  statusNeedingReason,
  statusReasonPrompt,
} from "@/lib/tasks/task-status-reason";
import {
  currentFavoriteProjectIds,
  sortFavoriteProjectsFirst,
} from "@/lib/resources/project-sort";
import {
  favoriteProjectsGroupLabel,
  projectOptionGroup,
} from "@/components/projects";

const priorities: Priority[] = ["low", "medium", "high", "urgent"];

export type TaskFieldOptions = {
  statuses: Status[];
  categories: Category[];
  projects: Project[];
  favoriteProjectIds: string[];
  profiles: Profile[];
  currentProfileId: string;
  accessibleCategoryIds?: string[];
  /** The status the task sits in today, so only a real move asks for a reason. */
  currentStatusId?: string | null;
};

export function TaskFields({
  draft,
  setDraft,
  options,
  density = "full",
}: {
  draft: TaskDraft;
  setDraft: Dispatch<SetStateAction<TaskDraft>>;
  options: TaskFieldOptions;
  density?: "full" | "quick";
}) {
  const reasonStatus = statusNeedingReason(
    options.statuses,
    draft.status_id,
    options.currentStatusId ?? null,
  );
  const currentFavoriteIds = currentFavoriteProjectIds(
    options.projects,
    options.favoriteProjectIds,
  );
  const favoriteProjectIds = new Set(currentFavoriteIds);
  const accessibleCategoryIds = options.accessibleCategoryIds
    ? new Set(options.accessibleCategoryIds)
    : null;
  const tagOptions = options.categories
    .filter((category) => draft.category_ids.includes(category.id))
    .flatMap((category) =>
      (category.tags ?? []).map((tag) => ({
        group: { color: category.color, label: category.name },
        label: tag,
        value: JSON.stringify([category.id, tag]),
      })),
    );
  const selectedTagValues = Object.entries(draft.category_tags).flatMap(
    ([categoryId, tags]) =>
      tags.map((tag) => JSON.stringify([categoryId, tag])),
  );

  function patch(next: Partial<TaskDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  return (
    <div className="min-w-0 space-y-5">
      <Input
        label="Task title"
        name="task-title"
        required
        value={draft.title}
        onChange={(event) => patch({ title: event.target.value })}
        placeholder="What needs doing?"
      />
      {density === "full" && (
        <div className="flex flex-col gap-2">
          <label htmlFor="task-description" className={getFieldLabelClasses()}>
            Description
          </label>
          <RichTextarea
            id="task-description"
            name="description"
            aria-label="Description"
            value={draft.description ?? ""}
            onChange={(event) => patch({ description: event.target.value })}
            placeholder="Add useful context, links, or a tiny pep talk…"
          />
        </div>
      )}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <DropdownSelect
          variant="field"
          label="Status"
          required
          value={draft.status_id}
          onChange={(status_id) => patch({ status_id })}
          options={options.statuses.map((item) => ({
            label: item.name,
            value: item.id,
          }))}
        />
        <DropdownSelect
          variant="field"
          label="Priority"
          required
          value={draft.priority}
          onChange={(priority) => patch({ priority: priority as Priority })}
          options={priorities.map((item) => ({
            label: item[0].toUpperCase() + item.slice(1),
            value: item,
          }))}
        />
        {reasonStatus && (
          <div className="sm:col-span-2">
            <Textarea
              id="task-status-reason"
              name="task-status-reason"
              label={statusReasonPrompt(reasonStatus)}
              required
              rows={3}
              maxLength={2000}
              value={draft.status_reason}
              onChange={(event) => patch({ status_reason: event.target.value })}
              placeholder="What made this the right call?"
            />
            <p className="mt-2 text-xs text-black/60 dark:text-white/60">
              Saved as a comment on the task so the decision stays with it.
            </p>
          </div>
        )}
        <fieldset className="sm:col-span-2" aria-required="true">
          <legend className="mb-2 flex gap-1 text-sm font-semibold">
            <span>Categories</span>
            <span className="text-red-500">*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {options.categories
              .filter(
                (item) =>
                  !item.archived_at || draft.category_ids.includes(item.id),
              )
              .map((item) => {
                const selected = draft.category_ids.includes(item.id);
                const accessible =
                  !accessibleCategoryIds || accessibleCategoryIds.has(item.id);
                return (
                  <Tooltip
                    key={item.id}
                    disabled={accessible}
                    content={
                      accessible
                        ? undefined
                        : "You don't have permission to use this category."
                    }
                  >
                    <label
                      className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition focus-within:ring-2 focus-within:ring-black/20 dark:focus-within:ring-white/30 ${accessible ? "cursor-pointer" : "cursor-not-allowed opacity-55"} ${selected ? "border-black/25 bg-black text-white dark:border-white/30 dark:bg-white dark:text-black" : "border-black/10 bg-white dark:border-white/10 dark:bg-white/5"}`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={selected}
                        disabled={!accessible}
                        onChange={() =>
                          patch({
                            category_ids: selected
                              ? draft.category_ids.filter(
                                  (id) => id !== item.id,
                                )
                              : [...draft.category_ids, item.id],
                            category_tags: selected
                              ? Object.fromEntries(
                                  Object.entries(draft.category_tags).filter(
                                    ([id]) => id !== item.id,
                                  ),
                                )
                              : draft.category_tags,
                          })
                        }
                      />
                      <i
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.name}
                      {!accessible && <FiLock aria-hidden />}
                    </label>
                  </Tooltip>
                );
              })}
          </div>
        </fieldset>
        {density === "full" && (
          <DropdownSelect
            variant="field"
            label="Project"
            proximityGroup={favoriteProjectsGroupLabel}
            value={draft.project_id ?? ""}
            onChange={(project_id) => patch({ project_id: project_id || null })}
            options={[
              {
                group: projectOptionGroup(false),
                label: "No project",
                value: "",
              },
              ...sortFavoriteProjectsFirst(
                options.projects.filter(
                  (item) => !item.archived_at || item.id === draft.project_id,
                ),
                currentFavoriteIds,
              ).map((item) => ({
                group: projectOptionGroup(favoriteProjectIds.has(item.id)),
                label: `${item.name}${item.archived_at ? " (archived)" : ""}`,
                value: item.id,
              })),
            ]}
          />
        )}
        <MultiSelect
          label="Assignees"
          placeholder="Unassigned"
          proximityValue={options.currentProfileId}
          value={draft.assignee_ids}
          onChange={(assignee_ids) => patch({ assignee_ids })}
          options={options.profiles.map((item) => ({
            avatar: { name: profileDisplayName(item), src: item.avatar_url },
            label: profileDisplayName(item),
            value: item.id,
          }))}
        />
        {density === "full" && (
          <DropdownSelect
            variant="field"
            label="Reported by"
            proximityValue={options.currentProfileId}
            required
            value={draft.reported_by}
            onChange={(reported_by) => patch({ reported_by })}
            options={options.profiles.map((item) => ({
              avatar: { name: profileDisplayName(item), src: item.avatar_url },
              label: profileDisplayName(item),
              value: item.id,
            }))}
          />
        )}
        <label className="date-field">
          <span>Due date</span>
          <input
            type="date"
            value={draft.due_date ?? ""}
            onChange={(event) =>
              patch({
                due_date: event.target.value || null,
                due_time: event.target.value ? draft.due_time : null,
              })
            }
          />
        </label>
        {density === "full" && (
          <MultiSelect
            label="Tags"
            className="sm:col-span-2"
            summaryLimit={6}
            options={tagOptions}
            value={selectedTagValues}
            onChange={(values) => {
              const category_tags: Record<string, string[]> = {};
              for (const value of values) {
                const [categoryId, tag] = JSON.parse(value) as [string, string];
                category_tags[categoryId] = [
                  ...(category_tags[categoryId] ?? []),
                  tag,
                ];
              }
              patch({ category_tags });
            }}
            searchable
            searchPlaceholder="Search tags"
            disabled={tagOptions.length === 0}
            placeholder={
              draft.category_ids.length === 0
                ? "Select a category first"
                : "No tags for selected categories"
            }
          />
        )}
      </div>
    </div>
  );
}
