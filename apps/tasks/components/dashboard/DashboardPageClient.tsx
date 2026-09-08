"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Button,
  CardAction,
  ConfirmationDialog,
  EmptyState,
  IconButton,
} from "@ryanmeetup/ui";
import {
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiFileText,
  FiSend,
  FiStar,
  FiTrash2,
} from "react-icons/fi";
import { CategoriesModal } from "@/components/categories";
import { categoryController } from "@/components/categories/category-workspace";
import { LatestChangelogCard } from "@/components/changelog";
import { MetricLinkCard, WorkspacePageShell } from "@/components/global";
import { ProjectsModal } from "@/components/projects";
import { NewTaskModal, TaskKeyBadge } from "@/components/tasks";
import { withAccessPreview } from "@/lib/access/access-preview";
import type { ChangelogRelease } from "@/lib/changelog";
import {
  deleteTaskDraft,
  readTaskDrafts,
  taskDraftsChangedEvent,
  type StoredTaskDraft,
} from "@/lib/tasks/task-drafts";
import { demoTaskDrafts } from "@/lib/workspace/demo-drafts";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { taskPath } from "@/lib/tasks/task-key";
import { profileDisplayName } from "@/lib/presentation";
import { taskStatusChange } from "@/lib/activity/task-activity";
import { formatShortTimestamp } from "@/lib/date-format";
import { projectPath } from "@/lib/resources/project-route";
import {
  boundedWidgetPage,
  DashboardTaskList,
  SectionCard,
  StatusBadge,
  WidgetPagination,
  widgetPageSize,
} from "./DashboardWidgets";

const dayMs = 24 * 60 * 60 * 1000;

export function DashboardPageClient({
  initialData,
  demoMode,
  latestChangelogRelease,
}: {
  initialData: WorkspaceData;
  demoMode: boolean;
  latestChangelogRelease: ChangelogRelease;
}) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [assignedPage, setAssignedPage] = useState(0);
  const [reportedPage, setReportedPage] = useState(0);
  const [upcomingPage, setUpcomingPage] = useState(0);
  const [activityPage, setActivityPage] = useState(0);
  const [draftPage, setDraftPage] = useState(0);
  const [favoriteProjectPage, setFavoriteProjectPage] = useState(0);
  const [drafts, setDrafts] = useState<StoredTaskDraft[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<StoredTaskDraft | null>(
    null,
  );
  const [draftPendingDelete, setDraftPendingDelete] =
    useState<StoredTaskDraft | null>(null);
  // Demo builds have no browser storage to read from, so the widget runs on
  // fixtures instead and a deletion only has to hold for the session.
  const discardedDemoDrafts = useRef(new Set<string>());
  const refreshDrafts = useCallback(() => {
    if (data.accessPreview) return;
    setDrafts(
      demoMode
        ? demoTaskDrafts.filter(
            (item) => !discardedDemoDrafts.current.has(item.id),
          )
        : readTaskDrafts(data.currentProfile.id),
    );
  }, [data.accessPreview, data.currentProfile.id, demoMode]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(refreshDrafts, 0);
    window.addEventListener(taskDraftsChangedEvent, refreshDrafts);
    window.addEventListener("storage", refreshDrafts);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener(taskDraftsChangedEvent, refreshDrafts);
      window.removeEventListener("storage", refreshDrafts);
    };
  }, [refreshDrafts]);
  const subjectId =
    data.accessPreview?.kind === "user"
      ? data.accessPreview.subjectId
      : data.currentProfile.id;
  const subjectName =
    data.accessPreview?.kind === "user"
      ? data.accessPreview.subjectName
      : profileDisplayName(data.currentProfile);
  const completedStatusIds = useMemo(
    () =>
      new Set(
        data.statuses
          .filter((status) => status.is_completed)
          .map((status) => status.id),
      ),
    [data.statuses],
  );
  const activeTasks = useMemo(
    () => data.tasks.filter((task) => !completedStatusIds.has(task.status_id)),
    [completedStatusIds, data.tasks],
  );
  const assigneesByTask = useMemo(() => {
    const result = new Map<string, Set<string>>();
    data.taskAssignees.forEach((row) => {
      const ids = result.get(row.task_id) ?? new Set<string>();
      ids.add(row.profile_id);
      result.set(row.task_id, ids);
    });
    return result;
  }, [data.taskAssignees]);
  const assignedToMe = useMemo(
    () =>
      activeTasks.filter((task) =>
        assigneesByTask.get(task.id)?.has(subjectId),
      ),
    [activeTasks, assigneesByTask, subjectId],
  );
  const reportedByMe = useMemo(
    () => activeTasks.filter((task) => task.reported_by === subjectId),
    [activeTasks, subjectId],
  );
  const upcoming = useMemo(() => {
    const now = new Date();
    const soon = new Date(now.getTime() + 14 * dayMs);
    return activeTasks
      .filter((task) => {
        if (!task.due_date) return false;
        const due = new Date(`${task.due_date}T23:59:59`);
        return (
          due >= now &&
          due <= soon &&
          Boolean(assigneesByTask.get(task.id)?.has(subjectId))
        );
      })
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  }, [activeTasks, assigneesByTask, subjectId]);
  const relevantTaskIds = useMemo(
    () => new Set([...assignedToMe, ...reportedByMe].map((task) => task.id)),
    [reportedByMe, assignedToMe],
  );
  const recentActivity = data.activity.filter((item) =>
    item.task_id ? relevantTaskIds.has(item.task_id) : false,
  );
  const favoriteProjects = data.projects.filter(
    (project) =>
      !project.archived_at &&
      (data.currentProfile.favorite_project_ids ?? []).includes(project.id),
  );
  const visibleAssignedPage = boundedWidgetPage(
    assignedPage,
    assignedToMe.length,
  );
  const visibleReportedPage = boundedWidgetPage(
    reportedPage,
    reportedByMe.length,
  );
  const visibleUpcomingPage = boundedWidgetPage(upcomingPage, upcoming.length);
  const visibleActivityPage = boundedWidgetPage(
    activityPage,
    recentActivity.length,
  );
  const visibleDraftPage = boundedWidgetPage(draftPage, drafts.length);
  const visibleFavoriteProjectPage = boundedWidgetPage(
    favoriteProjectPage,
    favoriteProjects.length,
  );
  const tasks = new Map(data.tasks.map((task) => [task.id, task]));
  const profiles = new Map(
    data.profiles.map((profile) => [profile.id, profile]),
  );
  const viewAllAssigned = withAccessPreview(
    `/board?assignee=${encodeURIComponent(subjectName)}`,
    data.accessPreview,
  );

  return (
    <>
      <WorkspacePageShell
        data={data}
        demoMode={demoMode}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onCreateCategory={() => setCategoryCreateOpen(true)}
        onCreateProject={() => setProjectCreateOpen(true)}
        onNewTask={() => setNewTaskOpen(true)}
        setData={setData}
        contentClassName="relative overflow-hidden p-4 sm:p-6 lg:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-16 h-80 w-80 rounded-full bg-amber-300/15 blur-3xl dark:bg-amber-300/[0.06]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/3 top-80 h-96 w-96 rounded-full bg-blue-300/10 blur-3xl dark:bg-blue-400/[0.05]"
        />
        <div className="relative mx-auto max-w-7xl space-y-6">
          {!demoMode && (
            <LatestChangelogCard
              preview={data.accessPreview}
              release={latestChangelogRelease}
            />
          )}

          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {[
              {
                label: "Assigned to me",
                mobileLabel: "Assigned",
                value: assignedToMe.length,
                icon: <FiCheckCircle />,
                href: viewAllAssigned,
              },
              {
                label: "Reported by me",
                mobileLabel: "Reported",
                value: reportedByMe.length,
                icon: <FiSend />,
                href: withAccessPreview(
                  `/board?reporter=${encodeURIComponent(subjectName)}`,
                  data.accessPreview,
                ),
              },
              {
                label: "Due within 14 days",
                mobileLabel: "Due soon",
                value: upcoming.length,
                icon: <FiCalendar />,
                href: withAccessPreview(
                  `/board?dueWithin=14&assignee=${encodeURIComponent(subjectName)}`,
                  data.accessPreview,
                ),
              },
            ].map((item, index) => (
              <MetricLinkCard
                key={item.label}
                href={item.href}
                icon={item.icon}
                label={item.label}
                mobileLabel={item.mobileLabel}
                tone={index === 0 ? "blue" : index === 1 ? "violet" : "amber"}
                value={item.value}
              />
            ))}
          </div>

          <div className="gap-6 xl:columns-2">
            <div className="mb-6 break-inside-avoid">
              <SectionCard
                title="Assigned to me"
                icon={<FiCheckCircle />}
                tone="blue"
                action={
                  <CardAction.Link href={viewAllAssigned}>
                    View all
                  </CardAction.Link>
                }
              >
                <DashboardTaskList
                  data={data}
                  tasks={assignedToMe.slice(
                    visibleAssignedPage * widgetPageSize,
                    (visibleAssignedPage + 1) * widgetPageSize,
                  )}
                  empty="Nothing assigned to you right now."
                />
                <WidgetPagination
                  label="assigned tasks"
                  page={visibleAssignedPage}
                  total={assignedToMe.length}
                  onPageChange={setAssignedPage}
                />
              </SectionCard>
            </div>

            {data.accessPreview?.kind !== "group" && (
              <div className="mb-6 break-inside-avoid">
                <SectionCard
                  title="Favorite projects"
                  icon={<FiStar />}
                  tone="gold"
                  action={
                    <CardAction.Link
                      href={withAccessPreview("/projects", data.accessPreview)}
                    >
                      View all
                    </CardAction.Link>
                  }
                >
                  {favoriteProjects.length ? (
                    <ul className="divide-y divide-black/10 dark:divide-white/10">
                      {favoriteProjects
                        .slice(
                          visibleFavoriteProjectPage * widgetPageSize,
                          (visibleFavoriteProjectPage + 1) * widgetPageSize,
                        )
                        .map((project) => (
                          <li key={project.id}>
                            <Link
                              href={withAccessPreview(
                                projectPath(project, data.projects),
                                data.accessPreview,
                              )}
                              className="group flex items-center gap-3 px-4 py-4 transition hover:bg-black/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:hover:bg-white/[0.035] dark:focus-visible:ring-white/40"
                            >
                              <FiStar
                                className="shrink-0 text-amber-600 dark:text-amber-300"
                                fill="currentColor"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold group-hover:underline">
                                  {project.name}
                                </span>
                                {project.description && (
                                  <span className="mt-1 block truncate text-xs text-black/55 dark:text-white/55">
                                    {project.description}
                                  </span>
                                )}
                              </span>
                              <FiArrowRight className="shrink-0 text-black/35 transition-transform group-hover:translate-x-0.5 dark:text-white/35" />
                            </Link>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center px-6 py-10 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-xl text-amber-700 dark:bg-amber-400/15 dark:text-amber-200">
                        <FiStar aria-hidden="true" />
                      </span>
                      <p className="mt-4 text-sm font-semibold">
                        Your favorite projects will live here.
                      </p>
                      <p className="mt-1 max-w-sm text-sm text-black/60 dark:text-white/60">
                        Favorite a few projects to keep your go-to work close at
                        hand.
                      </p>
                      <Button.Link
                        href={withAccessPreview(
                          "/projects",
                          data.accessPreview,
                        )}
                        variant="secondary"
                        size="sm"
                        leftIcon={<FiStar />}
                        className="mt-5 w-full sm:w-auto"
                      >
                        Browse projects
                      </Button.Link>
                    </div>
                  )}
                  <WidgetPagination
                    label="favorite projects"
                    page={visibleFavoriteProjectPage}
                    total={favoriteProjects.length}
                    onPageChange={setFavoriteProjectPage}
                  />
                </SectionCard>
              </div>
            )}

            {!data.accessPreview && (
              <div
                id="saved-drafts"
                className="mb-6 break-inside-avoid scroll-mt-20"
              >
                <SectionCard title="Drafts" icon={<FiFileText />} tone="violet">
                  {drafts.length > 0 ? (
                    <ul className="divide-y divide-black/10 dark:divide-white/10">
                      {drafts
                        .slice(
                          visibleDraftPage * widgetPageSize,
                          (visibleDraftPage + 1) * widgetPageSize,
                        )
                        .map((item) => (
                          <li
                            key={item.id}
                            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">
                                {item.draft.title.trim() || "Untitled task"}
                              </span>
                              <span className="mt-1 block text-xs text-black/50 dark:text-white/50">
                                Saved{" "}
                                {new Date(item.updatedAt).toLocaleString()}
                              </span>
                            </span>
                            <span className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                leftIcon={<FiEdit2 />}
                                onClick={() => setSelectedDraft(item)}
                              >
                                Continue
                              </Button>
                              <IconButton
                                label={`Delete “${item.draft.title || "untitled draft"}”`}
                                size="sm"
                                variant="danger"
                                onClick={() => setDraftPendingDelete(item)}
                              >
                                <FiTrash2 />
                              </IconButton>
                            </span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <EmptyState
                      variant="plain"
                      message="No saved drafts right now."
                    />
                  )}
                  <WidgetPagination
                    label="drafts"
                    page={visibleDraftPage}
                    total={drafts.length}
                    onPageChange={setDraftPage}
                  />
                </SectionCard>
              </div>
            )}

            <div className="mb-6 break-inside-avoid xl:[break-before:column]">
              <SectionCard
                title="Upcoming deadlines"
                icon={<FiCalendar />}
                tone="gold"
              >
                <DashboardTaskList
                  data={data}
                  tasks={upcoming.slice(
                    visibleUpcomingPage * widgetPageSize,
                    (visibleUpcomingPage + 1) * widgetPageSize,
                  )}
                  empty="No deadlines coming up in the next 14 days."
                />
                <WidgetPagination
                  label="upcoming deadlines"
                  page={visibleUpcomingPage}
                  total={upcoming.length}
                  onPageChange={setUpcomingPage}
                />
              </SectionCard>
            </div>
            <div className="mb-6 break-inside-avoid">
              <SectionCard
                title="Reported by me"
                icon={<FiSend />}
                tone="violet"
                action={
                  <CardAction.Link
                    href={withAccessPreview(
                      `/board?view=list&reporter=${encodeURIComponent(subjectName)}`,
                      data.accessPreview,
                    )}
                  >
                    View all
                  </CardAction.Link>
                }
              >
                <DashboardTaskList
                  data={data}
                  tasks={reportedByMe.slice(
                    visibleReportedPage * widgetPageSize,
                    (visibleReportedPage + 1) * widgetPageSize,
                  )}
                  empty="You haven't reported any active tasks."
                />
                <WidgetPagination
                  label="reported tasks"
                  page={visibleReportedPage}
                  total={reportedByMe.length}
                  onPageChange={setReportedPage}
                />
              </SectionCard>
            </div>
            <div className="mb-6 break-inside-avoid">
              <SectionCard
                title="Recent status changes"
                icon={<FiClock />}
                tone="green"
                action={
                  <CardAction.Link
                    href={withAccessPreview(
                      "/activity?events=moved",
                      data.accessPreview,
                    )}
                  >
                    All activity
                  </CardAction.Link>
                }
              >
                {recentActivity.length ? (
                  <ul className="divide-y divide-black/10 dark:divide-white/10">
                    {recentActivity
                      .slice(
                        visibleActivityPage * widgetPageSize,
                        (visibleActivityPage + 1) * widgetPageSize,
                      )
                      .map((item) => {
                        const task = item.task_id
                          ? tasks.get(item.task_id)
                          : undefined;
                        const actor = item.actor_id
                          ? profiles.get(item.actor_id)
                          : undefined;
                        const change = taskStatusChange(item, data.statuses);
                        return (
                          <li key={item.id} className="px-4 py-4">
                            <Link
                              href={withAccessPreview(
                                task ? taskPath(task) : "/activity",
                                data.accessPreview,
                              )}
                              className="group block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40"
                            >
                              <span className="text-sm font-semibold group-hover:underline">
                                {task && (
                                  <TaskKeyBadge
                                    task={task}
                                    className="mr-2 align-middle"
                                  />
                                )}
                                {task?.title ?? "Task"}
                              </span>
                              <span className="mt-2 flex flex-wrap items-center gap-2">
                                {change.from && (
                                  <StatusBadge status={change.from} />
                                )}
                                <FiArrowRight
                                  className="text-black/35 dark:text-white/35"
                                  aria-label="moved to"
                                />
                                <StatusBadge status={change.to} />
                              </span>
                              <span className="mt-2 block text-xs text-black/50 dark:text-white/50">
                                {profileDisplayName(actor)} ·{" "}
                                {formatShortTimestamp(
                                  new Date(item.created_at),
                                )}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                ) : (
                  <EmptyState
                    variant="plain"
                    message="No recent status changes on your tasks."
                  />
                )}
                <WidgetPagination
                  label="recent status changes"
                  page={visibleActivityPage}
                  total={recentActivity.length}
                  onPageChange={setActivityPage}
                />
              </SectionCard>
            </div>
          </div>
        </div>
      </WorkspacePageShell>
      <CategoriesModal
        modal={{ open: categoryCreateOpen, setOpen: setCategoryCreateOpen }}
        controller={categoryController(data, setData, demoMode)}
        options={{ createOnly: true }}
      />
      <ProjectsModal
        modal={{ open: projectCreateOpen, setOpen: setProjectCreateOpen }}
        workspace={{ data, setData, demoMode }}
        options={{ createOnly: true }}
      />
      {!data.accessPreview && (newTaskOpen || selectedDraft) && (
        <NewTaskModal
          data={data}
          demoMode={demoMode}
          open
          setData={setData}
          setOpen={(open) => {
            if (!open) {
              setNewTaskOpen(false);
              setSelectedDraft(null);
              refreshDrafts();
            }
          }}
          initialDraft={selectedDraft}
        />
      )}
      <ConfirmationDialog
        open={Boolean(draftPendingDelete)}
        setOpen={(open) => {
          if (!open) setDraftPendingDelete(null);
        }}
        title="Delete draft?"
        description={
          draftPendingDelete
            ? `Delete “${draftPendingDelete.draft.title.trim() || "Untitled task"}”? This saved draft cannot be recovered.`
            : ""
        }
        confirmLabel="Delete draft"
        destructive
        onConfirm={() => {
          if (!draftPendingDelete) return;
          if (demoMode) discardedDemoDrafts.current.add(draftPendingDelete.id);
          else deleteTaskDraft(data.currentProfile.id, draftPendingDelete.id);
          refreshDrafts();
          setDraftPendingDelete(null);
        }}
      />
    </>
  );
}
