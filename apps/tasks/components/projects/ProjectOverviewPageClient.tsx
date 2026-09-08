"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Breadcrumbs,
  Button,
  Card,
  CardAction,
  EmptyState,
  Tooltip,
} from "@ryanmeetup/ui";
import {
  FiActivity,
  FiAlertCircle,
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiColumns,
  FiEdit2,
  FiFolder,
  FiLink,
  FiPlus,
  FiUsers,
} from "react-icons/fi";
import { CategoriesModal } from "@/components/categories";
import { categoryController } from "@/components/categories/category-workspace";
import {
  CountBadge,
  MetricLinkCard,
  PageHeader,
  WorkspacePageShell,
  editorTriggers,
} from "@/components/global";
import {
  NewTaskModal,
  TaskDueDate,
  TaskKeyBadge,
  TaskPriorityBadge,
} from "@/components/tasks";
import { ActivityRows } from "@/components/activity/ActivityRows";
import { useProjectFavorites } from "@/hooks/useProjectFavorites";
import { withAccessPreview } from "@/lib/access/access-preview";
import { canViewWorkspaceArea } from "@/lib/access/workspace-areas";
import {
  calendarItems,
  type CalendarEvent,
} from "@/lib/calendar/calendar-types";
import { formatCalendarDate } from "@/lib/date-format";
import { resolveActivityRows } from "@/lib/activity/activity-presentation";
import { profileDisplayName } from "@/lib/presentation";
import {
  projectBoardPresetPath,
  projectNeedsAttention,
  projectOverviewMetrics,
  projectProgress,
  projectTeam,
  projectUpcomingRange,
} from "@/lib/resources/project-overview";
import { projectPath } from "@/lib/resources/project-route";
import { projectStatusDetails } from "@/lib/resources/project-status";
import { projectTimeline } from "@/lib/resources/project-timeline";
import type {
  ProjectAttachment,
  Project,
} from "@/lib/resources/resource-types";
import { taskPath } from "@/lib/tasks/task-key";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { ProjectFavoriteButton } from "./ProjectFavoriteButton";
import { ProjectContextCard } from "./ProjectContextCard";
import { ProjectsModal } from "./ProjectsModal";
import { ProjectTimelineSummary } from "./ProjectTimelineSummary";

/**
 * Project-level chips sit beside the title and describe the project itself,
 * so they share the status chip's shape rather than the neighbouring buttons'.
 */
const chipClassName =
  "inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.035] px-2.5 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] dark:border-white/10 dark:bg-white/[0.07]";

const dueChipToneClass = {
  danger: "text-red-700 dark:text-red-300",
  warning: "text-amber-700 dark:text-amber-300",
  neutral: "text-black/65 dark:text-white/70",
} as const;

function SectionHeading({
  action,
  icon,
  title,
}: {
  action?: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-black/10 px-4 py-3.5 dark:border-white/10 sm:px-5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-black/5 text-black/55 dark:bg-white/10 dark:text-white/60">
        {icon}
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

/**
 * A card can hold more than one list, so each group announces itself under the
 * card's own heading rather than being split into a separate card.
 */
function GroupHeading({
  action,
  divider,
  label,
}: {
  action?: React.ReactNode;
  divider?: boolean;
  label: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 border-b border-black/10 bg-black/[0.02] px-4 py-2.5 dark:border-white/10 dark:bg-white/[0.025] sm:px-5 ${divider ? "border-t" : ""}`}
    >
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50 dark:text-white/50">
        {label}
      </h3>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

export function ProjectOverviewPageClient({
  initialData,
  projectId,
  initialEvents,
  attachments,
  canEditProject,
  demoMode,
}: {
  initialData: WorkspaceData;
  projectId: string;
  initialEvents: CalendarEvent[];
  attachments: ProjectAttachment[];
  canEditProject: boolean;
  demoMode: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false);
  const [projectEditOpen, setProjectEditOpen] = useState(false);
  const router = useRouter();
  const favorites = useProjectFavorites({ data, setData, demoMode });
  const triggers = editorTriggers(data.currentProfile.editor_surface);
  const project = data.projects.find((item) => item.id === projectId);
  if (!project) return null;

  const tasks = data.tasks.filter((task) => task.project_id === project.id);
  const metrics = projectOverviewMetrics(tasks, data.statuses);
  const attention = projectNeedsAttention(
    tasks,
    data.statuses,
    data.taskAssignees,
  );
  const progress = projectProgress(tasks, data.statuses);
  const projectUrl = projectPath(project, data.projects);
  const boardHref = withAccessPreview(
    `/board?project=${encodeURIComponent(project.name)}`,
    data.accessPreview,
  );
  const projectMetricHref = (
    preset: Parameters<typeof projectBoardPresetPath>[2],
  ) =>
    withAccessPreview(
      projectBoardPresetPath(project.name, data.statuses, preset),
      data.accessPreview,
    );
  const activityHref = withAccessPreview(
    `/activity?projects=${encodeURIComponent(project.name)}`,
    data.accessPreview,
  );
  const upcoming = calendarItems(
    tasks,
    initialEvents,
    data.projects,
    data.categories,
    data.profiles,
    [],
    projectUpcomingRange(),
  ).slice(0, 6);
  const team = projectTeam(
    project.id,
    tasks,
    data.projectOwners,
    data.taskAssignees,
    data.profiles,
  );
  const teamGroups = [
    {
      label: "Project owners",
      members: team.filter((member) => member.isOwner),
      emptyMessage: "No owner assigned yet.",
    },
    {
      label: "Team members",
      members: team.filter((member) => !member.isOwner),
      emptyMessage: "No assignees on this project yet.",
    },
  ];
  const activityRows = resolveActivityRows(data.activity, {
    tasks,
    profiles: data.profiles,
    projects: data.projects,
    categories: data.categories,
    statuses: data.statuses,
  }).slice(0, 6);
  const status = projectStatusDetails(project.status);
  const timeline = projectTimeline(project);
  const isFavorite = favorites.isFavorite(project.id);
  const canOpenCalendar = canViewWorkspaceArea(
    data.accessibleAreas,
    "calendar",
  );

  return (
    <>
      <WorkspacePageShell
        data={data}
        demoMode={demoMode}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        setData={setData}
        onNewTask={() => setNewTaskOpen(true)}
        onCreateProject={() => setProjectCreateOpen(true)}
        onCreateCategory={() => setCategoryCreateOpen(true)}
        contentClassName="p-4 sm:p-6 lg:p-8"
      >
        <div className="mx-auto w-full max-w-[88rem] space-y-6">
          <Breadcrumbs
            variant="compact"
            crumbs={[
              {
                href: withAccessPreview("/projects", data.accessPreview),
                icon: <FiFolder aria-hidden />,
                title: "Projects",
              },
              {
                current: true,
                href: withAccessPreview(projectUrl, data.accessPreview),
                icon: <FiFolder aria-hidden />,
                title: project.name,
              },
            ]}
          />

          <PageHeader
            className="border-b border-black/10 pb-6 dark:border-white/10 sm:items-center sm:gap-8 xl:gap-12"
            title={project.name}
            kicker={
              <span className="flex flex-wrap items-center gap-2">
                <span
                  className={`${chipClassName} text-black/65 dark:text-white/70`}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  {status.label}
                </span>
                {timeline.due && (
                  <span
                    className={`${chipClassName} ${dueChipToneClass[timeline.due.tone]}`}
                  >
                    <FiCalendar aria-hidden className="h-3 w-3" />
                    {timeline.due.daysRemaining < 0 ? "Overdue" : "Due"}{" "}
                    {formatCalendarDate(timeline.due.date)}
                  </span>
                )}
              </span>
            }
            titleActions={
              !data.accessPreview ? (
                <ProjectFavoriteButton
                  projectName={project.name}
                  favorite={isFavorite}
                  pending={favorites.isPending(project.id)}
                  onToggle={() => void favorites.toggle(project)}
                />
              ) : undefined
            }
            description={
              project.description ||
              "A shared view of the work, dates, and context that move this project forward."
            }
            actions={
              <div className="flex w-full gap-2 sm:w-auto sm:items-center sm:justify-end">
                <Button.Link
                  href={boardHref}
                  size="lg"
                  className="flex-1 sm:flex-none"
                  leftIcon={<FiColumns aria-hidden />}
                  rightIcon={<FiArrowRight aria-hidden />}
                >
                  Open task board
                </Button.Link>
                {canEditProject && triggers.route && (
                  <Button.Link
                    href={`/projects/${project.id}/edit?from=${encodeURIComponent(projectUrl)}`}
                    variant="secondary"
                    size="lg"
                    leftIcon={<FiEdit2 aria-hidden />}
                    className={`flex-1 sm:flex-none ${triggers.routeClassName}`}
                  >
                    Edit project
                  </Button.Link>
                )}
                {canEditProject && triggers.dialog && (
                  <Button
                    variant="secondary"
                    size="lg"
                    leftIcon={<FiEdit2 aria-hidden />}
                    onClick={() => setProjectEditOpen(true)}
                    className={`flex-1 sm:flex-none ${triggers.dialogClassName}`}
                  >
                    Edit project
                  </Button>
                )}
              </div>
            }
          />

          <section
            aria-label="Project at a glance"
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            {[
              {
                label: "Open tasks",
                value: metrics.open,
                icon: <FiClock />,
                href: projectMetricHref("open"),
                tone: "blue" as const,
              },
              {
                label: "Overdue",
                value: metrics.overdue,
                icon: <FiAlertCircle />,
                href: projectMetricHref("overdue"),
                tone: "red" as const,
              },
              {
                label: "Due in 14 days",
                mobileLabel: "Due soon",
                value: metrics.dueSoon,
                icon: <FiCalendar />,
                href: projectMetricHref("due-soon"),
                tone: "amber" as const,
              },
              {
                label: "Complete",
                value: `${metrics.completionPercentage}%`,
                detail: `${metrics.completed} of ${metrics.total}`,
                icon: <FiCheckCircle />,
                tone: "green" as const,
              },
            ].map((item) => (
              <MetricLinkCard
                key={item.label}
                detail={item.detail ? `${item.detail} tasks` : undefined}
                href={item.href}
                icon={item.icon}
                label={item.label}
                mobileLabel={item.mobileLabel}
                tone={item.tone}
                value={item.value}
              />
            ))}
          </section>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,1fr)]">
            <div
              data-testid="project-overview-main"
              className="min-w-0 space-y-6"
            >
              <Card size="none" className="overflow-hidden">
                <SectionHeading
                  title="Attention & dates"
                  icon={<FiAlertCircle aria-hidden />}
                  action={
                    !data.accessPreview ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<FiPlus aria-hidden />}
                        onClick={() => setNewTaskOpen(true)}
                      >
                        New task
                      </Button>
                    ) : undefined
                  }
                />
                <GroupHeading label="Needs attention" />
                {attention.length ? (
                  <ul className="divide-y divide-black/10 dark:divide-white/10">
                    {attention.map(({ task, reason, tone }) => (
                      <li key={task.id}>
                        <Link
                          href={withAccessPreview(
                            taskPath(task),
                            data.accessPreview,
                          )}
                          className="group grid gap-3 px-4 py-4 transition hover:bg-black/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:hover:bg-white/[0.035] dark:focus-visible:ring-white/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
                        >
                          <span className="min-w-0">
                            <span className="font-semibold group-hover:underline">
                              <TaskKeyBadge
                                task={task}
                                className="mr-2 align-middle"
                              />
                              {task.title}
                            </span>
                            <span
                              className={`mt-1.5 block text-xs font-medium ${tone === "danger" ? "text-red-700 dark:text-red-300" : tone === "warning" ? "text-amber-700 dark:text-amber-300" : "text-black/55 dark:text-white/55"}`}
                            >
                              {reason}
                            </span>
                          </span>
                          <span className="flex items-center gap-3">
                            <TaskPriorityBadge priority={task.priority} />
                            <TaskDueDate
                              dueDate={task.due_date}
                              isCompleted={false}
                              showIcon
                            />
                            <FiArrowRight
                              aria-hidden
                              className="text-black/35 transition-transform group-hover:translate-x-0.5 dark:text-white/35"
                            />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <EmptyState
                      variant="plain"
                      message={
                        tasks.length
                          ? "Nothing is overdue or urgently unassigned."
                          : "No tasks yet. Add the first piece of work when this project is ready."
                      }
                    />
                    {!data.accessPreview && tasks.length === 0 && (
                      <div className="flex justify-center pb-8">
                        <Button
                          size="sm"
                          leftIcon={<FiPlus aria-hidden />}
                          onClick={() => setNewTaskOpen(true)}
                        >
                          Create the first task
                        </Button>
                      </div>
                    )}
                  </>
                )}
                <GroupHeading
                  divider
                  label="Next 90 days"
                  action={
                    canOpenCalendar ? (
                      <CardAction.Link
                        href={withAccessPreview(
                          "/calendar",
                          data.accessPreview,
                        )}
                      >
                        Calendar
                      </CardAction.Link>
                    ) : undefined
                  }
                />
                {upcoming.length ? (
                  <ul className="divide-y divide-black/10 dark:divide-white/10">
                    {upcoming.map((item) => (
                      <li key={item.id}>
                        {item.href ? (
                          <Link
                            href={withAccessPreview(
                              item.href,
                              data.accessPreview,
                            )}
                            className="group flex gap-3 px-4 py-3.5 transition hover:bg-black/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:hover:bg-white/[0.035] dark:focus-visible:ring-white/40 sm:px-5"
                          >
                            <UpcomingDate item={item} />
                          </Link>
                        ) : (
                          <div className="flex gap-3 px-4 py-3.5 sm:px-5">
                            <UpcomingDate item={item} />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    variant="plain"
                    message="No project dates in the next 90 days."
                  />
                )}
              </Card>

              <Card size="none" className="overflow-hidden">
                <SectionHeading
                  title="Progress by status"
                  icon={<FiCheckCircle aria-hidden />}
                  action={
                    <CardAction.Link href={boardHref}>
                      Open board
                    </CardAction.Link>
                  }
                />
                {progress.length ? (
                  <div className="space-y-5 p-4 sm:p-5">
                    <div
                      className="grid h-3 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"
                      aria-label={`${metrics.completionPercentage}% of project tasks complete`}
                      style={{
                        gridTemplateColumns: progress
                          .map(({ count }) => `${count}fr`)
                          .join(" "),
                      }}
                    >
                      {progress.map(({ status: item, count }) => {
                        const percentage =
                          Math.round(
                            (count / Math.max(metrics.total, 1)) * 1000,
                          ) / 10;
                        const taskLabel = count === 1 ? "task" : "tasks";

                        return (
                          <Tooltip
                            key={item.id}
                            triggerClassName="h-full min-w-0"
                            content={
                              <span className="block min-w-32">
                                <span className="block font-semibold">
                                  {item.name}
                                </span>
                                <span className="mt-0.5 block opacity-75">
                                  {count} {taskLabel} · {percentage}% of project
                                </span>
                                <span className="mt-0.5 block opacity-75">
                                  Counts as{" "}
                                  {item.is_completed ? "completed" : "open"}{" "}
                                  work
                                </span>
                              </span>
                            }
                          >
                            <span
                              tabIndex={0}
                              aria-label={`${item.name}: ${count} ${taskLabel}, ${percentage}% of project tasks; counts as ${item.is_completed ? "completed" : "open"} work`}
                              className="h-full w-full cursor-help focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
                              style={{ backgroundColor: item.color }}
                            />
                          </Tooltip>
                        );
                      })}
                    </div>
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {progress.map(({ status: item, count }) => (
                        <li
                          key={item.id}
                          className="flex items-center gap-2 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.025]"
                        >
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {item.name}
                          </span>
                          <CountBadge label="task">{count}</CountBadge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <EmptyState
                    variant="plain"
                    message="Progress appears once this project has tasks."
                  />
                )}
              </Card>

              <Card size="none" className="overflow-hidden">
                <SectionHeading
                  title="Recent activity"
                  icon={<FiActivity aria-hidden />}
                  action={
                    <CardAction.Link href={activityHref}>
                      View all
                    </CardAction.Link>
                  }
                />
                <ActivityRows
                  rows={activityRows}
                  preview={data.accessPreview}
                  showMobileHeader={false}
                  showProject={false}
                  emptyMessage="Project activity will collect here as work changes."
                />
              </Card>
            </div>

            <aside
              data-testid="project-overview-sidebar"
              className="min-w-0 space-y-6 xl:sticky xl:top-24"
            >
              <Card size="none" className="overflow-hidden">
                <SectionHeading
                  title="Timeline"
                  icon={<FiClock aria-hidden />}
                />
                <div className="p-4 sm:p-5">
                  <ProjectTimelineSummary project={project} />
                </div>
              </Card>

              <Card size="none" className="overflow-hidden">
                <SectionHeading
                  title="Project team"
                  icon={<FiUsers aria-hidden />}
                />
                <div className="p-4 sm:p-5">
                  {team.length ? (
                    <div className="space-y-5">
                      {teamGroups.map((group) => (
                        <div key={group.label}>
                          <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
                            {group.label}
                          </p>
                          {group.members.length ? (
                            <ul className="grid gap-3 sm:grid-cols-2">
                              {group.members.map(({ profile }) => (
                                <li
                                  key={profile.id}
                                  className="flex items-center gap-3"
                                >
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
                          ) : (
                            <p className="text-sm text-black/50 dark:text-white/50">
                              {group.emptyMessage}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-black/55 dark:text-white/55">
                      No project team assigned yet.
                    </p>
                  )}
                </div>
              </Card>

              <ProjectContextCard
                project={project}
                attachments={attachments}
                canEdit={canEditProject && !data.accessPreview}
                demoMode={demoMode}
                currentUserId={data.currentProfile.id}
                onLinksSaved={(links) =>
                  setData((current) => ({
                    ...current,
                    projects: current.projects.map((item) =>
                      item.id === project.id ? { ...item, links } : item,
                    ),
                  }))
                }
                heading={(action) => (
                  <SectionHeading
                    title="Project context"
                    icon={<FiLink aria-hidden />}
                    action={action}
                  />
                )}
              />
            </aside>
          </div>
        </div>
      </WorkspacePageShell>

      {newTaskOpen && !data.accessPreview && (
        <NewTaskModal
          data={data}
          demoMode={demoMode}
          open={newTaskOpen}
          setData={setData}
          setOpen={setNewTaskOpen}
          initialValues={{ project_id: project.id }}
        />
      )}
      {projectEditOpen && canEditProject && (
        <ProjectsModal
          modal={{ open: projectEditOpen, setOpen: setProjectEditOpen }}
          workspace={{ data, setData, demoMode }}
          options={{ editProjectId: project.id }}
          events={{
            onProjectUpdated: (updated: Project) => {
              router.replace(
                projectPath(
                  updated,
                  data.projects.map((item) =>
                    item.id === updated.id ? updated : item,
                  ),
                ),
              );
            },
          }}
        />
      )}
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

function UpcomingDate({
  item,
}: {
  item: ReturnType<typeof calendarItems>[number];
}) {
  return (
    <>
      <span
        aria-hidden
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: item.color }}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{item.title}</span>
        <span className="mt-0.5 block text-xs text-black/55 dark:text-white/55">
          {formatCalendarDate(item.start)}
          {item.meta ? ` · ${item.meta}` : ""}
        </span>
      </span>
    </>
  );
}
