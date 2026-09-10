import { FilterPanel } from "@ryanmeetup/ui";
import type { Category, Project } from "@/lib/resources/resource-types";
import type { Priority, Status } from "@/lib/tasks/task-types";
import type { Profile } from "@/lib/workspace/workspace-types";
import { filterPanelsExpandedPreferenceKey } from "@/lib/user-preferences";
import { CategoryFilterMenu } from "./CategoryFilterMenu";
import { InclusionFilterMenu } from "./InclusionFilterMenu";
import { profileDisplayName } from "@/lib/presentation";
import { sortFavoriteProjectsFirst } from "@/lib/resources/project-sort";
import {
  favoriteProjectsGroupLabel,
  projectOptionGroup,
} from "@/components/projects";
import { categoryTagFilterValue } from "@/lib/tasks/task-filter-values";

const priorities: Priority[] = ["low", "medium", "high", "urgent"];

export type TaskFilterKey =
  | "assignee"
  | "reporter"
  | "project"
  | "status"
  | "priority"
  | "dueWithin"
  | "tag";

type InclusionSelection = { included: string[]; excluded: string[] };

export type TaskFilterOptions = {
  categories: Category[];
  currentProfileId: string;
  favoriteProjectIds: string[];
  profiles: Profile[];
  projects: Project[];
  statuses: Status[];
};

export type TaskFilterController = {
  count: number;
  categories: InclusionSelection;
  selections: Record<TaskFilterKey, InclusionSelection>;
  clear: () => void;
  setCategories: (kind: "included" | "excluded", values: string[]) => void;
  setSelection: (
    filter: TaskFilterKey,
    kind: "included" | "excluded",
    values: string[],
  ) => void;
};

export function TaskFilters({
  options,
  controller,
}: {
  options: TaskFilterOptions;
  controller: TaskFilterController;
}) {
  const { categories, currentProfileId, profiles, projects, statuses } =
    options;
  const favoriteProjectIds = new Set(options.favoriteProjectIds);
  const {
    count,
    categories: categorySelection,
    selections,
    clear,
    setCategories,
    setSelection,
  } = controller;

  return (
    <FilterPanel
      collapseOnMobile
      count={count}
      className="mb-6"
      controlsClassName="grid grid-cols-1 gap-3 overflow-visible sm:grid-cols-2 lg:flex lg:gap-2 lg:overflow-x-auto"
      onClear={clear}
      preferenceStorageKey={filterPanelsExpandedPreferenceKey}
    >
      <InclusionFilterMenu
        label="Assignee"
        proximityValue={currentProfileId}
        anyLabel="Anyone"
        options={[
          { label: "Unassigned", value: "unassigned" },
          ...profiles.map((profile) => ({
            avatar: {
              name: profileDisplayName(profile),
              src: profile.avatar_url,
            },
            label: profileDisplayName(profile),
            value: profile.id,
          })),
        ]}
        includedValues={selections.assignee.included}
        excludedValues={selections.assignee.excluded}
        onIncludedChange={(values) =>
          setSelection("assignee", "included", values)
        }
        onExcludedChange={(values) =>
          setSelection("assignee", "excluded", values)
        }
        stackLabelOnMobile
      />
      <CategoryFilterMenu
        categories={categories}
        includedIds={categorySelection.included}
        excludedIds={categorySelection.excluded}
        onIncludedChange={(values) => setCategories("included", values)}
        onExcludedChange={(values) => setCategories("excluded", values)}
        stackLabelOnMobile
      />
      <InclusionFilterMenu
        label="Tags"
        anyLabel="All tags"
        options={categories.flatMap((category) =>
          category.tags.map((tag) => ({
            group: { color: category.color, label: category.name },
            label: tag,
            value: categoryTagFilterValue({ categoryId: category.id, tag }),
          })),
        )}
        includedValues={selections.tag.included}
        excludedValues={selections.tag.excluded}
        onIncludedChange={(values) => setSelection("tag", "included", values)}
        onExcludedChange={(values) => setSelection("tag", "excluded", values)}
        stackLabelOnMobile
      />
      <InclusionFilterMenu
        label="Reported by"
        proximityValue={currentProfileId}
        anyLabel="Anyone"
        options={profiles.map((profile) => ({
          avatar: {
            name: profileDisplayName(profile),
            src: profile.avatar_url,
          },
          label: profileDisplayName(profile),
          value: profile.id,
        }))}
        includedValues={selections.reporter.included}
        excludedValues={selections.reporter.excluded}
        onIncludedChange={(values) =>
          setSelection("reporter", "included", values)
        }
        onExcludedChange={(values) =>
          setSelection("reporter", "excluded", values)
        }
        stackLabelOnMobile
      />
      <InclusionFilterMenu
        label="Project"
        anyLabel="All projects"
        proximityGroup={favoriteProjectsGroupLabel}
        options={[
          {
            group: projectOptionGroup(false),
            label: "No project",
            value: "none",
          },
          ...sortFavoriteProjectsFirst(
            projects,
            options.favoriteProjectIds,
          ).map((item) => ({
            group: projectOptionGroup(favoriteProjectIds.has(item.id)),
            label: `${item.name}${item.archived_at ? " (archived)" : ""}`,
            value: item.id,
          })),
        ]}
        includedValues={selections.project.included}
        excludedValues={selections.project.excluded}
        onIncludedChange={(values) =>
          setSelection("project", "included", values)
        }
        onExcludedChange={(values) =>
          setSelection("project", "excluded", values)
        }
        stackLabelOnMobile
      />
      <InclusionFilterMenu
        label="Status"
        anyLabel="All statuses"
        options={statuses.map((item) => ({ label: item.name, value: item.id }))}
        includedValues={selections.status.included}
        excludedValues={selections.status.excluded}
        onIncludedChange={(values) =>
          setSelection("status", "included", values)
        }
        onExcludedChange={(values) =>
          setSelection("status", "excluded", values)
        }
        stackLabelOnMobile
      />
      <InclusionFilterMenu
        label="Priority"
        anyLabel="All priorities"
        options={priorities.map((item) => ({
          label: item[0].toUpperCase() + item.slice(1),
          value: item,
        }))}
        includedValues={selections.priority.included}
        excludedValues={selections.priority.excluded}
        onIncludedChange={(values) =>
          setSelection("priority", "included", values)
        }
        onExcludedChange={(values) =>
          setSelection("priority", "excluded", values)
        }
        stackLabelOnMobile
      />
      <InclusionFilterMenu
        label="Due date"
        anyLabel="Any time"
        options={[
          { label: "Overdue", value: "overdue" },
          { label: "Next 7 days", value: "7" },
          { label: "Next 14 days", value: "14" },
          { label: "Next 30 days", value: "30" },
        ]}
        includedValues={selections.dueWithin.included}
        excludedValues={selections.dueWithin.excluded}
        onIncludedChange={(values) =>
          setSelection("dueWithin", "included", values)
        }
        onExcludedChange={(values) =>
          setSelection("dueWithin", "excluded", values)
        }
        stackLabelOnMobile
      />
    </FilterPanel>
  );
}
