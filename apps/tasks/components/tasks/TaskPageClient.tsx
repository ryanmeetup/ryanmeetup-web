"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Breadcrumbs,
  Button,
  Card,
  ConfirmationDialog,
  DropdownMenu,
  DropdownMenuButton,
  DropdownMenuItem,
  DropdownMenuItems,
  DropdownMenuSeparator,
  FormattedText,
  toast,
} from "@ryanmeetup/ui";
import {
  FiActivity,
  FiCalendar,
  FiCheckSquare,
  FiClock,
  FiColumns,
  FiEdit3,
  FiFlag,
  FiFolder,
  FiLink,
  FiMoreHorizontal,
  FiTag,
  FiTrash2,
  FiUser,
  FiUserCheck,
} from "react-icons/fi";
import {
  editorTriggers,
  useInstancePageTitle,
  WorkspacePageShell,
} from "@/components/global";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import { withAccessPreview } from "@/lib/access/access-preview";
import {
  createTaskMutationService,
  type TaskDraft,
} from "@/lib/tasks/task-mutations";
import { taskEditPath, taskKey, taskPath } from "@/lib/tasks/task-key";
import { errorMessage } from "@/lib/presentation";
import { formatTimestampDate } from "@/lib/date-format";
import { taskDraftFromTask } from "@/lib/tasks/task-draft-factory";
import { taskDraftValidationMessage } from "@/lib/tasks/task-draft-validation";
import type { Task } from "@/lib/tasks/task-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { taskEditorView } from "@/lib/tasks/task-editor-view";
import { projectPath } from "@/lib/resources/project-route";
import { TaskDetails } from "./TaskDetails";
import { TaskDueDate } from "./TaskDueDate";
import { TaskEditor } from "./TaskEditor";
import { NewTaskModal } from "./NewTaskModal";
import { TaskPriorityBadge } from "./TaskPriorityBadge";
import { closesWork } from "@/lib/tasks/status-outcome";

export function TaskPageClient({
  initialData,
  taskId,
  demoMode,
}: {
  initialData: WorkspaceData;
  taskId: string;
  demoMode: boolean;
}) {
  const { data, setData, getData } = useWorkspaceData(initialData, demoMode);
  const mutations = useMemo(
    () => createTaskMutationService({ demoMode, getData, setData }),
    [demoMode, getData, setData],
  );
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(true);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskMessage, setTaskMessage] = useState("");
  const [taskPendingDelete, setTaskPendingDelete] = useState<Task | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<{
    task: Task;
    draft: TaskDraft;
  } | null>(null);
  const [taskDeleting, setTaskDeleting] = useState(false);
  const conversationTopRef = useRef<HTMLDivElement>(null);
  const [conversationHeight, setConversationHeight] = useState<number>();
  const pageTitle = useInstancePageTitle();
  const task =
    data.tasks.find((item) => item.id === taskId) ??
    initialData.tasks.find((item) => item.id === taskId)!;

  useEffect(() => {
    document.title = pageTitle(`${taskKey(task)}: ${task.title}`);
  }, [pageTitle, task]);

  const triggers = editorTriggers(data.currentProfile.editor_surface);
  const status = data.statuses.find((item) => item.id === task.status_id);
  const project = data.projects.find((item) => item.id === task.project_id);
  const assigneeIds = new Set(
    data.taskAssignees
      .filter((item) => item.task_id === task.id)
      .map((item) => item.profile_id),
  );
  const assignees = data.profiles.filter((item) => assigneeIds.has(item.id));
  const reporter = data.profiles.find((item) => item.id === task.reported_by);
  const categoryIds = new Set(
    data.taskCategories
      .filter((item) => item.task_id === task.id)
      .map((item) => item.category_id),
  );
  const categories = data.categories.filter((item) => categoryIds.has(item.id));
  const makeDraft = () => taskDraftFromTask(task, categoryIds, assigneeIds);
  const [draft, setDraft] = useState<TaskDraft>(makeDraft);

  useEffect(() => {
    function measureConversation() {
      const top = conversationTopRef.current?.getBoundingClientRect().top;
      if (top !== undefined) {
        setConversationHeight(Math.max(320, window.innerHeight - top - 32));
      }
    }
    measureConversation();
    window.addEventListener("resize", measureConversation);
    return () => window.removeEventListener("resize", measureConversation);
  }, []);

  function openEditor() {
    setDraft(makeDraft());
    setTaskMessage("");
    setTaskDetailsOpen(false);
    setTaskOpen(true);
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationMessage = taskDraftValidationMessage(draft, {
      statuses: data.statuses,
      currentStatusId: task.status_id,
    });
    if (validationMessage) {
      setTaskMessage(validationMessage);
      toast.error(validationMessage);
      return;
    }
    setTaskMessage("");
    setTaskSaving(true);
    try {
      const saved = await mutations.save(draft, task);
      mutations.applySaved(saved, true);
      setTaskOpen(false);
      toast.successWithLink("Task updated:", {
        href: taskPath(saved.task),
        linkLabel: taskKey(saved.task),
      });
    } catch (error) {
      const message = errorMessage(error, "The task could not be saved.");
      setTaskMessage(message);
      toast.error(message);
    } finally {
      setTaskSaving(false);
    }
  }

  async function deleteTask() {
    setTaskDeleting(true);
    try {
      await mutations.remove(task.id);
      toast.success("Task deleted.");
      router.push("/");
    } catch (error) {
      toast.error(errorMessage(error, "The task could not be deleted."));
    } finally {
      setTaskDeleting(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        new URL(taskPath(task!), window.location.origin).toString(),
      );
      toast.success(`${taskKey(task!)} link copied.`);
    } catch {
      toast.error("The task link could not be copied.");
    }
  }

  return (
    <>
      <WorkspacePageShell
        data={data}
        demoMode={demoMode}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        setData={setData}
        contentClassName="mx-auto w-full min-w-0 max-w-[84rem] space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8"
      >
        <div className="min-w-0 space-y-2">
          <Breadcrumbs
            crumbs={[
              {
                current: false,
                href: withAccessPreview("/board", data.accessPreview),
                icon: <FiColumns aria-hidden className="mr-2 shrink-0" />,
                title: "Board",
              },
              {
                current: true,
                href: withAccessPreview(taskPath(task), data.accessPreview),
                icon: <FiCheckSquare aria-hidden className="mr-2 shrink-0" />,
                title: taskKey(task),
              },
            ]}
          />
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,480px)] xl:gap-6">
            <h1 className="min-w-0 break-words text-2xl font-bold leading-tight sm:text-4xl">
              {task.title}
            </h1>
            <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto sm:justify-self-end xl:w-full xl:self-end">
              {!data.accessPreview && (
                <>
                  {/* Route or dialog, per the profile — see editor-routes.ts. */}
                  {triggers.route && (
                    <Button.Link
                      href={taskEditPath(task)}
                      size="sm"
                      fullWidth
                      leftIcon={<FiEdit3 />}
                      className={`${triggers.routeClassName} sm:w-auto`}
                    >
                      Edit task
                    </Button.Link>
                  )}
                  {triggers.dialog && (
                    <Button
                      size="sm"
                      fullWidth
                      leftIcon={<FiEdit3 />}
                      onClick={openEditor}
                      className={`${triggers.dialogClassName} sm:w-auto`}
                    >
                      Edit task
                    </Button>
                  )}
                </>
              )}
              <DropdownMenu>
                <DropdownMenuButton
                  unstyled
                  aria-label="More task actions"
                  className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-black/10 text-black transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:text-white dark:hover:bg-white/10 dark:focus-visible:ring-white/30"
                >
                  <FiMoreHorizontal aria-hidden />
                </DropdownMenuButton>
                <DropdownMenuItems align="end">
                  <DropdownMenuItem onClick={copyLink}>
                    <FiLink aria-hidden /> Copy link
                  </DropdownMenuItem>
                  {!data.accessPreview && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        onClick={() => setTaskPendingDelete(task)}
                      >
                        <FiTrash2 aria-hidden /> Delete task
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuItems>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,480px)]">
          <div className="contents min-w-0 xl:block xl:space-y-6">
            <Card className="order-1 min-w-0 space-y-5">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
                  Description
                </h2>
                {task.description ? (
                  <FormattedText
                    text={task.description}
                    className="mt-3 min-w-0 break-words text-sm leading-7 text-black/75 dark:text-white/75"
                  />
                ) : (
                  <p className="mt-3 text-sm text-black/50 dark:text-white/50">
                    No description yet.
                  </p>
                )}
              </div>
              {categories.length > 0 && (
                <div>
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                    Categories
                  </p>
                  <div className="space-y-3">
                    {categories.map((category) => {
                      const categoryTags =
                        task.category_tags?.[category.id] ?? [];
                      return (
                        <div key={category.id} className="min-w-0">
                          <span
                            className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold text-black/75 dark:text-white/80"
                            style={{
                              borderColor: `${category.color}99`,
                              backgroundColor: `${category.color}12`,
                            }}
                          >
                            <i
                              aria-hidden="true"
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            {category.name}
                          </span>
                          {categoryTags.length > 0 && (
                            <ul
                              className="mt-2 flex flex-wrap gap-1.5"
                              aria-label={`Tags in ${category.name}`}
                            >
                              {categoryTags.map((tag) => (
                                <li
                                  key={tag}
                                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none text-black/65 dark:text-white/70"
                                  style={{
                                    borderColor: `${category.color}55`,
                                    backgroundColor: `${category.color}14`,
                                  }}
                                >
                                  <FiTag
                                    aria-hidden
                                    className="h-3 w-3 shrink-0"
                                    style={{ color: category.color }}
                                  />
                                  <span className="min-w-0 break-words">{tag}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>

            <TaskDetails
              task={task}
              workspace={{ data, demoMode, setData }}
              display={{
                active: true,
                pageLayout: true,
                section: "work",
                className: "order-3",
              }}
            />
            <TaskDetails
              task={task}
              workspace={{ data, demoMode, setData }}
              display={{
                active: true,
                pageLayout: true,
                section: "comment",
                className: "order-4",
              }}
            />
          </div>

          <div className="contents min-w-0 xl:sticky xl:top-24 xl:block xl:space-y-6">
            <Card className="order-2 min-w-0 space-y-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
                Task details
              </h2>
              <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 text-sm sm:gap-x-6">
                <div>
                  <dt className="flex items-center gap-1.5 text-black/50 dark:text-white/50">
                    <FiCalendar aria-hidden /> Created
                  </dt>
                  <dd className="mt-1 font-semibold">
                    {formatTimestampDate(task.created_at)}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-black/50 dark:text-white/50">
                    <FiClock aria-hidden /> Due
                  </dt>
                  <dd className="mt-1 font-semibold">
                    {task.due_date ? (
                      <TaskDueDate
                        dueDate={task.due_date}
                        isCompleted={status ? closesWork(status) : false}
                        showIcon
                      />
                    ) : (
                      "No due date"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-black/50 dark:text-white/50">
                    <FiActivity aria-hidden /> Status
                  </dt>
                  <dd className="mt-1 flex min-w-0 items-center gap-2 break-words font-semibold">
                    {status && (
                      <i
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                    )}
                    {status?.name ?? "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-black/50 dark:text-white/50">
                    <FiFlag aria-hidden /> Priority
                  </dt>
                  <dd className="mt-1">
                    <TaskPriorityBadge priority={task.priority} />
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-black/50 dark:text-white/50">
                    <FiUser aria-hidden /> Reported by
                  </dt>
                  <dd className="mt-1 flex min-w-0 items-center gap-2 break-words font-semibold">
                    <Avatar
                      name={reporter?.full_name ?? "Unknown"}
                      src={reporter?.avatar_url}
                      size="sm"
                    />
                    {reporter?.full_name ?? "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-black/50 dark:text-white/50">
                    <FiUserCheck aria-hidden /> Assignees
                  </dt>
                  {assignees.length === 0 ? (
                    <dd className="mt-1 flex min-w-0 items-center gap-2 break-words font-semibold">
                      <Avatar name="Unassigned" size="sm" />
                      Unassigned
                    </dd>
                  ) : (
                    assignees.map((person) => (
                      <dd
                        key={person.id}
                        className="mt-1 flex min-w-0 items-center gap-2 break-words font-semibold"
                      >
                        <Avatar
                          name={person.full_name}
                          src={person.avatar_url}
                          size="sm"
                        />
                        {person.full_name}
                      </dd>
                    ))
                  )}
                </div>
                <div className="col-span-2 min-w-0">
                  <dt className="flex items-center gap-1.5 text-black/50 dark:text-white/50">
                    <FiFolder aria-hidden /> Project
                  </dt>
                  <dd className="mt-1 break-words font-semibold">
                    {project ? (
                      <Link
                        href={withAccessPreview(
                          projectPath(project, data.projects),
                          data.accessPreview,
                        )}
                        className="underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40"
                      >
                        {project.name}
                      </Link>
                    ) : (
                      "No project"
                    )}
                  </dd>
                </div>
              </dl>
            </Card>

            <div
              ref={conversationTopRef}
              className="order-5 overflow-hidden rounded-2xl"
              style={
                conversationHeight
                  ? { maxHeight: conversationHeight }
                  : undefined
              }
            >
              <TaskDetails
                task={task}
                workspace={{ data, demoMode, setData }}
                display={{
                  active: true,
                  pageLayout: true,
                  section: "activity",
                  conversationHeight,
                }}
              />
            </div>
          </div>
        </div>
      </WorkspacePageShell>

      <TaskEditor
        showSupplementalDetails={false}
        showTaskPageLink={false}
        modal={{
          open: taskOpen,
          setOpen: setTaskOpen,
          detailsOpen: taskDetailsOpen,
          setDetailsOpen: setTaskDetailsOpen,
        }}
        form={{
          draft,
          setDraft,
          saving: taskSaving,
          message: taskMessage,
          onSubmit: saveTask,
        }}
        view={taskEditorView(data)}
        mode={{
          kind: "edit",
          task,
          onDelete: setTaskPendingDelete,
          onDuplicate: () => {
            setDuplicateSource({
              task,
              draft: {
                ...draft,
                category_ids: [...draft.category_ids],
                category_tags: { ...draft.category_tags },
              },
            });
            setTaskOpen(false);
          },
        }}
      />
      {duplicateSource && (
        <NewTaskModal
          data={data}
          demoMode={demoMode}
          open
          setData={setData}
          setOpen={(nextOpen) => {
            if (!nextOpen) setDuplicateSource(null);
          }}
          duplicateOf={duplicateSource}
        />
      )}
      <ConfirmationDialog
        open={Boolean(taskPendingDelete)}
        setOpen={(open) => {
          if (!open) setTaskPendingDelete(null);
        }}
        title="Delete Task?"
        description="This task and its related comments, attachments, and activity will be permanently removed."
        confirmLabel="Delete task"
        pendingLabel="Deleting..."
        pending={taskDeleting}
        destructive
        onConfirm={() => void deleteTask()}
      />
    </>
  );
}
