"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  DropdownSelect,
  FilterPanel,
  Pagination,
  toast,
} from "@ryanmeetup/ui";
import { FiClock } from "react-icons/fi";
import { CategoriesModal } from "@/components/categories";
import { categoryController } from "@/components/categories/category-workspace";
import {
  CountBadge,
  PageHeader,
  WorkspacePageShell,
} from "@/components/global";
import { filterPanelsExpandedPreferenceKey } from "@/lib/user-preferences";
import {
  favoriteProjectsGroupLabel,
  projectOptionGroup,
  ProjectsModal,
} from "@/components/projects";
import { sortFavoriteProjectsFirst } from "@/lib/resources/project-sort";
import { useQueryParamState } from "@ryanmeetup/hooks";
import { usePagination } from "@/hooks/usePagination";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { ActivityFilterMenu } from "./ActivityFilterMenu";
import { ActivityRows } from "./ActivityRows";
import {
  errorMessage,
  profileDisplayName,
  splitCommaSeparated,
} from "@/lib/presentation";
import { resolveActivityRows } from "@/lib/activity/activity-presentation";
import {
  activityFilterCount,
  buildActivityQuery,
} from "@/lib/activity/activity-query";
import { ACTIVITY_EVENT_OPTIONS } from "@/lib/activity/activity-events";
import {
  COMPLETED_STATUS_TARGET,
  moveFilterValue,
} from "@/lib/activity/activity-moves";

export function ActivityPageClient({
  initialData,
  demoMode,
}: {
  initialData: WorkspaceData;
  demoMode: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false);
  const [loading, setLoading] = useState(!demoMode);
  const [projectFilter, setProjectFilter] = useQueryParamState("projects", "");
  const [excludedProjects, setExcludedProjects] = useQueryParamState(
    "excludeProjects",
    "",
  );
  const [personFilter, setPersonFilter] = useQueryParamState("people", "");
  const [excludedPeople, setExcludedPeople] = useQueryParamState(
    "excludePeople",
    "",
  );
  const [kindFilter, setKindFilter] = useQueryParamState("events", "");
  const [excludedEvents, setExcludedEvents] = useQueryParamState(
    "excludeEvents",
    "",
  );
  const [moveFilter, setMoveFilter] = useQueryParamState("moves", "");
  const [excludedMoves, setExcludedMoves] = useQueryParamState(
    "excludeMoves",
    "",
  );
  const [timeFilter, setTimeFilter] = useQueryParamState("when", "all");
  const { page, pageSize, setPage, setPageSize, syncPage, syncPageSize } =
    usePagination();
  const previewKind = data.accessPreview?.kind;
  const previewSubjectId = data.accessPreview?.subjectId;
  const previewSubjectName = data.accessPreview?.subjectName;
  const activityRows = useMemo(
    () =>
      resolveActivityRows(data.activity, {
        tasks: data.tasks,
        profiles: data.profiles,
        projects: data.projects,
        categories: data.categories,
        statuses: data.statuses,
      }),
    [data],
  );
  const includedProjectValues = splitCommaSeparated(projectFilter);
  const excludedProjectValues = splitCommaSeparated(excludedProjects);
  const includedPersonValues = splitCommaSeparated(personFilter);
  const excludedPersonValues = splitCommaSeparated(excludedPeople);
  const includedEventValues = splitCommaSeparated(kindFilter);
  const excludedEventValues = splitCommaSeparated(excludedEvents);
  const includedMoveValues = splitCommaSeparated(moveFilter);
  const excludedMoveValues = splitCommaSeparated(excludedMoves);
  // One menu, two groups: picking only from "Moved into" answers "what landed
  // in Done?", and adding a "Moved out of" entry narrows that to the single
  // transition rather than widening it to a second pile of rows.
  const moveOptions = useMemo(
    () =>
      (
        [
          { direction: "to", label: "Moved into" },
          { direction: "from", label: "Moved out of" },
        ] as const
      ).flatMap(({ direction, label }) => {
        const group = { label };
        return [
          ...(data.statuses.some((status) => status.is_completed)
            ? [
                {
                  group,
                  label: "Any done status",
                  value: moveFilterValue(direction, COMPLETED_STATUS_TARGET),
                },
              ]
            : []),
          ...[...data.statuses]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((status) => ({
              color: status.color,
              group,
              label: status.name,
              value: moveFilterValue(direction, status.name),
            })),
        ];
      }),
    [data.statuses],
  );
  const filters = useMemo(
    () => ({
      projects: projectFilter,
      excludeProjects: excludedProjects,
      people: personFilter,
      excludePeople: excludedPeople,
      events: kindFilter,
      excludeEvents: excludedEvents,
      moves: moveFilter,
      excludeMoves: excludedMoves,
      when: timeFilter,
    }),
    [
      excludedEvents,
      excludedMoves,
      excludedPeople,
      excludedProjects,
      kindFilter,
      moveFilter,
      personFilter,
      projectFilter,
      timeFilter,
    ],
  );
  const filterCount = activityFilterCount(filters);
  const favoriteProjectIds = data.currentProfile.favorite_project_ids ?? [];

  function setFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  function clearFilters() {
    setProjectFilter("");
    setExcludedProjects("");
    setPersonFilter("");
    setExcludedPeople("");
    setKindFilter("");
    setExcludedEvents("");
    setMoveFilter("");
    setExcludedMoves("");
    setTimeFilter("all");
    setPage(1);
  }

  useEffect(() => {
    const readableProjects = (value: string) =>
      splitCommaSeparated(value)
        .map(
          (item) =>
            data.projects.find(
              (project) => project.id === item || project.name === item,
            )?.name ?? item,
        )
        .join(",");
    const readablePeople = (value: string) =>
      splitCommaSeparated(value)
        .map((item) => {
          const profile = data.profiles.find(
            (entry) => entry.id === item || profileDisplayName(entry) === item,
          );
          return profile ? profileDisplayName(profile) : item;
        })
        .join(",");
    const nextProjects = readableProjects(projectFilter);
    const nextExcludedProjects = readableProjects(excludedProjects);
    const nextPeople = readablePeople(personFilter);
    const nextExcludedPeople = readablePeople(excludedPeople);
    if (nextProjects !== projectFilter) setProjectFilter(nextProjects);
    if (nextExcludedProjects !== excludedProjects)
      setExcludedProjects(nextExcludedProjects);
    if (nextPeople !== personFilter) setPersonFilter(nextPeople);
    if (nextExcludedPeople !== excludedPeople)
      setExcludedPeople(nextExcludedPeople);
  }, [
    data.profiles,
    data.projects,
    excludedPeople,
    excludedProjects,
    personFilter,
    projectFilter,
    setExcludedPeople,
    setExcludedProjects,
    setPersonFilter,
    setProjectFilter,
  ]);

  useEffect(() => {
    if (demoMode) return;
    const controller = new AbortController();
    const params = buildActivityQuery(
      filters,
      data.projects,
      data.profiles,
      data.statuses,
    );
    if (previewKind && previewSubjectId) {
      params.set(
        previewKind === "group" ? "viewAsGroup" : "viewAsUser",
        previewKind === "group" ? previewSubjectId : (previewSubjectName ?? ""),
      );
    }
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    queueMicrotask(() => {
      if (!controller.signal.aborted) setLoading(true);
    });
    void fetch(`/api/activity?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as {
          error?: string;
          activity?: WorkspaceData["activity"];
          tasks?: WorkspaceData["tasks"];
          page?: NonNullable<WorkspaceData["activityPage"]>;
        };
        if (!response.ok || !result.activity || !result.tasks || !result.page)
          throw new Error(result.error ?? "Activity could not be loaded.");
        setData((current) => ({
          ...current,
          activity: result.activity!,
          tasks: [
            ...current.tasks.filter(
              (task) => !result.tasks!.some((item) => item.id === task.id),
            ),
            ...result.tasks!,
          ],
          activityPage: result.page,
        }));
        syncPage(result.page.page);
        syncPageSize(result.page.pageSize);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        toast.error(errorMessage(error, "Activity could not be loaded."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    demoMode,
    filters,
    data.profiles,
    data.projects,
    data.statuses,
    excludedEvents,
    excludedMoves,
    excludedPeople,
    excludedProjects,
    kindFilter,
    moveFilter,
    page,
    pageSize,
    personFilter,
    previewKind,
    previewSubjectId,
    previewSubjectName,
    projectFilter,
    syncPage,
    syncPageSize,
    timeFilter,
  ]);

  return (
    <>
      <WorkspacePageShell
        data={data}
        demoMode={demoMode}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onCreateCategory={() => setCategoryCreateOpen(true)}
        onCreateProject={() => setProjectCreateOpen(true)}
        setData={setData}
        contentClassName="p-4 sm:p-6 lg:p-8"
      >
        <div className="space-y-6">
          <PageHeader
            kicker="Workspace history"
            icon={FiClock}
            title="Activity"
            badge={
              <CountBadge size="lg" label="event">
                {data.activityPage?.totalCount ?? data.activity.length}
              </CountBadge>
            }
            description="The latest task, note, contact, project, and category happenings."
          />

          <FilterPanel
            collapseOnMobile
            className="!border-black/15 !bg-black/[0.035] shadow-black/5 dark:!border-white/10 dark:!bg-white/5"
            count={filterCount}
            controlsClassName="grid grid-cols-1 gap-3 overflow-visible sm:grid-cols-2 lg:flex lg:gap-2 lg:overflow-x-auto"
            defaultExpanded
            onClear={clearFilters}
            preferenceStorageKey={filterPanelsExpandedPreferenceKey}
          >
            <ActivityFilterMenu
              label="Project"
              includedValues={includedProjectValues}
              excludedValues={excludedProjectValues}
              onIncludedChange={(values) =>
                setFilter(setProjectFilter, values.join(","))
              }
              onExcludedChange={(values) =>
                setFilter(setExcludedProjects, values.join(","))
              }
              proximityGroup={favoriteProjectsGroupLabel}
              options={[
                {
                  group: projectOptionGroup(false),
                  label: "No project",
                  value: "none",
                },
                ...sortFavoriteProjectsFirst(
                  data.projects,
                  favoriteProjectIds,
                ).map((project) => ({
                  group: projectOptionGroup(
                    favoriteProjectIds.includes(project.id),
                  ),
                  label: `${project.name}${project.archived_at ? " (archived)" : ""}`,
                  value: project.name,
                })),
              ]}
              stackLabelOnMobile
            />
            <ActivityFilterMenu
              label="Person"
              proximityValue={profileDisplayName(data.currentProfile)}
              includedValues={includedPersonValues}
              excludedValues={excludedPersonValues}
              onIncludedChange={(values) =>
                setFilter(setPersonFilter, values.join(","))
              }
              onExcludedChange={(values) =>
                setFilter(setExcludedPeople, values.join(","))
              }
              options={[
                { label: "System", value: "system" },
                ...data.profiles.map((profile) => ({
                  avatar: {
                    name: profileDisplayName(profile),
                    src: profile.avatar_url,
                  },
                  label: profileDisplayName(profile),
                  value: profileDisplayName(profile),
                })),
              ]}
              stackLabelOnMobile
            />
            <ActivityFilterMenu
              label="Event"
              includedValues={includedEventValues}
              excludedValues={excludedEventValues}
              onIncludedChange={(values) =>
                setFilter(setKindFilter, values.join(","))
              }
              onExcludedChange={(values) =>
                setFilter(setExcludedEvents, values.join(","))
              }
              options={[...ACTIVITY_EVENT_OPTIONS]}
              stackLabelOnMobile
            />
            <ActivityFilterMenu
              label="Status"
              emptyLabel="Any status change"
              includedValues={includedMoveValues}
              excludedValues={excludedMoveValues}
              onIncludedChange={(values) =>
                setFilter(setMoveFilter, values.join(","))
              }
              onExcludedChange={(values) =>
                setFilter(setExcludedMoves, values.join(","))
              }
              options={moveOptions}
              stackLabelOnMobile
            />
            <DropdownSelect
              label="When"
              active={timeFilter !== "all"}
              value={timeFilter}
              onChange={(value) => setFilter(setTimeFilter, value)}
              stackLabelOnMobile
              options={[
                { label: "Any time", value: "all" },
                { label: "Past 24 hours", value: "day" },
                { label: "Past 7 days", value: "week" },
                { label: "Past 30 days", value: "month" },
              ]}
            />
          </FilterPanel>

          <Card
            size="none"
            className={`overflow-hidden transition-opacity ${loading ? "opacity-60" : ""}`}
          >
            <ActivityRows
              rows={activityRows}
              loading={loading}
              preview={data.accessPreview}
              emptyMessage={
                filterCount === 0
                  ? "No activity yet. The next workspace update will show up here."
                  : "No activity matches these filters. Try widening your selection."
              }
            />
            <Pagination
              page={data.activityPage?.page ?? page}
              pageSize={data.activityPage?.pageSize ?? pageSize}
              totalCount={data.activityPage?.totalCount ?? data.activity.length}
              itemLabel="events"
              disabled={loading}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </Card>
        </div>
      </WorkspacePageShell>

      {projectCreateOpen && !data.accessPreview && (
        <ProjectsModal
          modal={{ open: projectCreateOpen, setOpen: setProjectCreateOpen }}
          workspace={{ data, setData, demoMode }}
          options={{ createOnly: true }}
        />
      )}
      {categoryCreateOpen && !data.accessPreview && (
        <CategoriesModal
          modal={{ open: categoryCreateOpen, setOpen: setCategoryCreateOpen }}
          controller={categoryController(data, setData, demoMode)}
          options={{ createOnly: true }}
        />
      )}
    </>
  );
}
