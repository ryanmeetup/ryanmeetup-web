"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  ManagementSurface,
  Modal,
  Pill,
  Tooltip,
} from "@ryanmeetup/ui";
import {
  FiClock,
  FiExternalLink,
  FiFolder,
  FiMoreHorizontal,
  FiPlus,
  FiUsers,
} from "react-icons/fi";
import {
  CountBadge,
  editorTriggers,
  type EditorTriggers,
  useEditorReturnPath,
  WorkspacePageShell,
} from "@/components/global";
import { GoogleEventModal } from "./GoogleEventModal";
import {
  TaskCategoryBadge,
  TaskKeyBadge,
  TaskPriorityBadge,
} from "@/components/tasks";
import {
  calendarItems,
  displayTime,
  itemsOnDate,
  monthBounds,
  workspaceTimeZoneLabel,
  type CalendarEvent,
  type CalendarEventKind,
  type CalendarItem,
} from "@/lib/calendar/calendar-types";
import {
  calendarDayLayout,
  compareTaskItems,
  moveCalendarMonth,
} from "@/lib/calendar/calendar-view";
import { GoogleCalendarSettingsModal } from "./GoogleCalendarControls";
import { CalendarGridAgenda } from "./CalendarGridAgenda";
import { CalendarEventEditorModal } from "./CalendarEventEditorModal";
import { useCalendarGoogle } from "./useCalendarGoogle";
import { useCalendarEventEditor } from "./useCalendarEventEditor";
import { withAccessPreview } from "@/lib/access/access-preview";
import { profileDisplayName } from "@/lib/presentation";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import type {
  GoogleCalendarConnection,
  GoogleCalendarEvent,
} from "@/lib/calendar/google-calendar-types";

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const calendarSidebarStorageKey = "ryanmeetup.tasks.calendar-sidebar-open";

/**
 * Where a phone goes to change this item. Workspace events get their editor
 * route; a Google import is read-only in Tasks, and a task tile already links
 * to the task, so both are left to the button's own behavior.
 */
function calendarEventEditHref(item: CalendarItem, returnPath: string) {
  if (item.google || item.href || !item.event) return undefined;
  return `/calendar/event/${item.event.id}/edit?from=${encodeURIComponent(returnPath)}`;
}

function Item({
  item,
  onOpen,
  editHref,
  triggers,
}: {
  item: CalendarItem;
  onOpen: () => void;
  /**
   * The dedicated edit route for this item, when there is one. Google tiles
   * have none: they are read-only in Tasks on every screen size, so their tile
   * keeps the button whatever the reader's editor surface is.
   */
  editHref?: string;
  triggers: EditorTriggers;
}) {
  const sourceClassName =
    item.source === "google"
      ? "bg-blue-500/10 hover:bg-blue-500/15 dark:bg-blue-400/10 dark:hover:bg-blue-400/15"
      : item.source === "away"
        ? "bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-400/10 dark:hover:bg-amber-400/15"
        : "bg-black/[0.035] hover:bg-black/[0.07] dark:bg-white/[0.06] dark:hover:bg-white/10";
  const className = `block min-w-0 rounded-md border-l-4 px-2 py-1.5 text-left text-[11px] leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40 ${sourceClassName}`;
  // The desktop trigger carries `sm:inline-flex`, which would make these two
  // lines flex siblings on one row. The wrapper keeps them a block stack: the
  // title reads first, the time and owner sit under it.
  const content = (
    <span className="block w-full min-w-0">
      <span className="block truncate font-semibold">{item.title}</span>
      {item.meta && (
        <span className="mt-0.5 block truncate text-[10px] text-black/55 dark:text-white/55">
          {item.meta}
        </span>
      )}
    </span>
  );
  if (item.href && item.external)
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className={className}
        style={{ borderColor: item.color }}
      >
        {content}
      </a>
    );
  if (item.href)
    return (
      <Link
        href={item.href}
        className={className}
        style={{ borderColor: item.color }}
      >
        {content}
      </Link>
    );
  return (
    <>
      {/* Route or dialog, per the profile — see editor-routes.ts. */}
      {editHref && triggers.route && (
        <Link
          href={editHref}
          className={`${className} w-full ${triggers.routeClassName}`}
          style={{ borderColor: item.color }}
        >
          {content}
        </Link>
      )}
      {(!editHref || triggers.dialog) && (
        <button
          type="button"
          className={`${className} w-full ${editHref ? triggers.dialogClassName : ""}`}
          style={{ borderColor: item.color }}
          // A Google tile opens a read-only dialog rather than the editor,
          // which is worth saying where the tile itself only shows a title and
          // a time.
          aria-label={
            item.google ? `${item.title} — view event details` : undefined
          }
          onClick={onOpen}
        >
          {content}
        </button>
      )}
    </>
  );
}

function TaskSummary({
  date,
  items,
  onOpen,
}: {
  date: string;
  items: CalendarItem[];
  onOpen: (date: string, items: CalendarItem[]) => void;
}) {
  return (
    <button
      type="button"
      className="block w-full min-w-0 rounded-md border-l-4 border-fuchsia-600 bg-fuchsia-500/[0.08] px-2 py-1.5 text-left text-[11px] leading-tight transition hover:bg-fuchsia-500/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500/40 dark:border-fuchsia-400 dark:bg-fuchsia-400/10 dark:hover:bg-fuchsia-400/15"
      onClick={() => onOpen(date, items)}
    >
      <span className="block truncate font-semibold">
        {items.length} {items.length === 1 ? "task" : "tasks"} due
      </span>
      <span className="mt-0.5 block truncate text-[10px] text-black/55 dark:text-white/55">
        View the day&apos;s deadlines
      </span>
    </button>
  );
}

export function CalendarPageClient({
  initialData,
  initialEvents,
  initialGoogleEvents,
  googleConnection: initialGoogleConnection,
  googleConfigured,
  googleCanManage,
  googleCanView,
  googleStatus,
  initialMonth,
  demoMode,
}: {
  initialData: WorkspaceData;
  initialEvents: CalendarEvent[];
  initialGoogleEvents: GoogleCalendarEvent[];
  googleConnection: GoogleCalendarConnection;
  googleConfigured: boolean;
  googleCanManage: boolean;
  googleCanView: boolean;
  googleStatus?: string;
  initialMonth: string;
  demoMode: boolean;
}) {
  const returnPath = useEditorReturnPath();
  const [data, setData] = useState(initialData);
  const [events, setEvents] = useState(initialEvents);
  const [month, setMonth] = useState(initialMonth);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calendarSidebarOpen, setCalendarSidebarOpen] = useState(true);
  const [googleEventId, setGoogleEventId] = useState<string | null>(null);
  const [dayAgenda, setDayAgenda] = useState<{
    date: string;
    items: CalendarItem[];
  } | null>(null);
  const [taskSummary, setTaskSummary] = useState<{
    date: string;
    items: CalendarItem[];
  } | null>(null);
  const [source, setSource] = useState("all");
  const previewing = Boolean(data.accessPreview);
  const triggers = editorTriggers(data.currentProfile.editor_surface);
  const google = useCalendarGoogle({
    accessPreview: data.accessPreview,
    canView: googleCanView,
    initialConnection: initialGoogleConnection,
    initialEvents: initialGoogleEvents,
    initialMonth,
    month,
    status: googleStatus,
  });
  const googleConnection = google.connection;
  const googleEvents = google.events;
  // Publishing is only offered where the shared calendar is already visible,
  // which is also how the modal knows a date is already on Google.
  const googleSyncAvailable =
    !demoMode && googleCanView && googleConnection.connected;
  const editor = useCalendarEventEditor({
    currentProfile: data.currentProfile,
    demoMode,
    events,
    googleEvents,
    googleSyncAvailable,
    previewing,
    setEvents,
    setGoogleEvents: google.setEvents,
  });
  // Reading the open event back out of the loaded month keeps the dialog on the
  // current copy, and closes it by itself when the month it belongs to is
  // replaced or the connection goes away.
  const googleEvent =
    googleEvents.find((event) => event.id === googleEventId) ?? null;
  const googleLoading = google.loading;
  const googleSyncing =
    googleLoading && (source === "all" || source === "google");
  const { days, monthNumber } = monthBounds(month);
  const currentDate = new Date().toISOString().slice(0, 10);
  const today = currentDate.slice(0, 7) === month ? currentDate : "";
  const allItems = useMemo(() => {
    // The grid is the widest thing drawn from these items, so it also bounds
    // how far a repeating date is expanded.
    const grid = monthBounds(month).days;
    return calendarItems(
      data.tasks,
      events,
      data.projects,
      data.categories,
      data.profiles,
      googleEvents,
      { start: grid[0], end: grid[grid.length - 1] },
    );
  }, [
    data.categories,
    data.profiles,
    data.projects,
    data.tasks,
    events,
    googleEvents,
    month,
  ]);
  const items =
    source === "all"
      ? allItems
      : allItems.filter((item) => item.source === source);
  const monthStart = `${month}-01`;
  const monthEnd = `${moveCalendarMonth(month, 1)}-01`;
  const monthItems = items.filter(
    (item) => item.start < monthEnd && item.end >= monthStart,
  );
  const agendaDates = days.filter(
    (date) =>
      date >= monthStart &&
      date < monthEnd &&
      itemsOnDate(monthItems, date).length > 0,
  );
  const upcomingDates = agendaDates.filter((date) => date >= currentDate);
  function toggleCalendarSidebar() {
    setCalendarSidebarOpen((current) => {
      const next = !current;
      localStorage.setItem(calendarSidebarStorageKey, String(next));
      return next;
    });
  }

  function openNew(kind: CalendarEventKind, date = today || `${month}-01`) {
    editor.openNew(kind, date);
  }

  // Workspace rows open the editor. An imported Google event is not ours to
  // change, so it opens the details dialog, which is where the invite Google
  // holds—notes, guests, joining details—is read without leaving Tasks.
  function openItem(item: CalendarItem) {
    if (item.google) {
      setGoogleEventId(item.google.id);
      return;
    }
    if (item.event) editor.openEvent(item.event);
  }

  function renderDayItems(date: string, dateItems: CalendarItem[], limit = 3) {
    const layout = calendarDayLayout(dateItems, limit);
    return (
      <>
        {layout.awayItems.map((item) => (
          <Item
            key={item.id}
            item={item}
            onOpen={() => openItem(item)}
            editHref={
              previewing ? undefined : calendarEventEditHref(item, returnPath)
            }
            triggers={triggers}
          />
        ))}
        {layout.taskItems.length > 0 && (
          <TaskSummary
            date={date}
            items={layout.taskItems}
            onOpen={(summaryDate, summaryItems) =>
              setTaskSummary({ date: summaryDate, items: summaryItems })
            }
          />
        )}
        {layout.otherItems.map((item) => (
          <Item
            key={item.id}
            item={item}
            onOpen={() => openItem(item)}
            editHref={
              previewing ? undefined : calendarEventEditHref(item, returnPath)
            }
            triggers={triggers}
          />
        ))}
        {layout.hiddenCount > 0 && (
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-[10px] font-semibold text-black/65 transition hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:text-white/65 dark:hover:bg-white/[0.08] dark:focus-visible:ring-white/40"
            onClick={() => setDayAgenda({ date, items: layout.orderedItems })}
          >
            <FiMoreHorizontal aria-hidden />
            View {layout.hiddenCount} more
          </button>
        )}
      </>
    );
  }

  useEffect(() => {
    const saved = localStorage.getItem(calendarSidebarStorageKey);
    if (saved === null) return;
    queueMicrotask(() => setCalendarSidebarOpen(saved === "true"));
  }, []);

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
              Calendar{" "}
              <CountBadge size="lg" label="event">
                {monthItems.length}
              </CountBadge>
            </>
          }
          description="Deadlines, important dates, meetings, and time away—one place to see what the team has coming up."
          actions={
            previewing ? (
              <Tooltip content="Exit access preview to change the calendar">
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  leftIcon={<FiPlus />}
                  disabled
                >
                  Add to calendar
                </Button>
              </Tooltip>
            ) : (
              <>
                {/* Route or dialog, per the profile — see editor-routes.ts. */}
                {triggers.route && (
                  <Button.Link
                    href={`/calendar/event/new?date=${today || `${month}-01`}&from=${encodeURIComponent(returnPath)}`}
                    size="sm"
                    className={`w-full ${triggers.routeClassName}`}
                    leftIcon={<FiPlus />}
                  >
                    Add to calendar
                  </Button.Link>
                )}
                {triggers.dialog && (
                  <Button
                    size="sm"
                    className={triggers.dialogClassName}
                    leftIcon={<FiPlus />}
                    onClick={() => openNew("important")}
                  >
                    Add to calendar
                  </Button>
                )}
              </>
            )
          }
        >
          <CalendarGridAgenda
            agendaDates={agendaDates}
            calendarSidebarOpen={calendarSidebarOpen}
            days={days}
            googleCanManage={googleCanManage}
            googleCanView={googleCanView}
            googleConfigured={googleConfigured}
            googleConnection={googleConnection}
            googleLoading={googleLoading}
            googleSyncing={googleSyncing}
            initialMonth={initialMonth}
            items={items}
            month={month}
            monthItems={monthItems}
            monthNumber={monthNumber}
            onOpenGoogleSettings={() => google.setSettingsOpen(true)}
            onOpenNew={(date) => openNew("important", date)}
            onToggleSidebar={toggleCalendarSidebar}
            renderDayItems={renderDayItems}
            setMonth={setMonth}
            setSource={setSource}
            source={source}
            today={today}
            upcomingDates={upcomingDates}
          />
        </ManagementSurface>
      </WorkspacePageShell>

      <GoogleEventModal
        event={googleEvent}
        onClose={() => setGoogleEventId(null)}
      />

      <GoogleCalendarSettingsModal
        canManage={googleCanManage}
        configured={googleConfigured}
        connection={googleConnection}
        demoMode={demoMode}
        disconnecting={google.disconnecting}
        loading={googleLoading}
        onDisconnect={google.disconnect}
        open={google.settingsOpen}
        setOpen={google.setSettingsOpen}
      />

      <Modal
        open={Boolean(dayAgenda)}
        setIsOpen={(open) => {
          if (!open) setDayAgenda(null);
        }}
        title={
          dayAgenda
            ? dayFormatter.format(new Date(`${dayAgenda.date}T00:00:00Z`))
            : "Day agenda"
        }
        description={
          dayAgenda
            ? `${dayAgenda.items.length} ${dayAgenda.items.length === 1 ? "item" : "items"} on the calendar. Time away stays at the top.`
            : undefined
        }
        size="lg"
      >
        <div className="space-y-2">
          {dayAgenda?.items.map((item) => (
            <Item
              key={`agenda:${item.id}`}
              item={
                item.source === "task" && item.href
                  ? {
                      ...item,
                      href: withAccessPreview(item.href, data.accessPreview),
                    }
                  : item
              }
              onOpen={() => {
                setDayAgenda(null);
                openItem(item);
              }}
              triggers={triggers}
            />
          ))}
        </div>
      </Modal>

      <Modal
        open={Boolean(taskSummary)}
        setIsOpen={(open) => {
          if (!open) setTaskSummary(null);
        }}
        title={
          taskSummary
            ? `Tasks due ${dayFormatter.format(new Date(`${taskSummary.date}T00:00:00Z`))}`
            : "Tasks due"
        }
        description={
          taskSummary
            ? `${taskSummary.items.length} ${taskSummary.items.length === 1 ? "task is" : "tasks are"} due on this day, ordered by urgency.`
            : undefined
        }
        size="lg"
      >
        <div className="space-y-2">
          {taskSummary &&
            [...taskSummary.items].sort(compareTaskItems).map((item) => {
              const task = item.task;
              const status = data.statuses.find(
                (candidate) => candidate.id === task?.status_id,
              );
              const assigneeIds = new Set(
                data.taskAssignees
                  .filter((assignment) => assignment.task_id === task?.id)
                  .map((assignment) => assignment.profile_id),
              );
              const assignees = data.profiles.filter((profile) =>
                assigneeIds.has(profile.id),
              );
              const project = data.projects.find(
                (candidate) => candidate.id === task?.project_id,
              );
              const categoryIds = new Set(
                data.taskCategories
                  .filter((assignment) => assignment.task_id === task?.id)
                  .map((assignment) => assignment.category_id),
              );
              const categories = data.categories.filter((category) =>
                categoryIds.has(category.id),
              );
              const subtasks = data.subtasks.filter(
                (subtask) => subtask.task_id === task?.id,
              );
              const completedSubtasks = subtasks.filter(
                (subtask) => subtask.is_completed,
              ).length;
              const href = withAccessPreview(
                item.href ?? "/board",
                data.accessPreview,
              );
              return (
                <Link
                  key={item.id}
                  href={href}
                  aria-label={`Open ${item.title}`}
                  className="group block rounded-xl border border-black/10 bg-black/[0.025] p-4 transition hover:-translate-y-0.5 hover:border-black/25 hover:bg-black/[0.04] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 motion-reduce:transform-none dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/30 dark:hover:bg-white/[0.07] dark:focus-visible:ring-white/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    {task && <TaskKeyBadge task={task} />}
                    <span className="flex shrink-0 items-center gap-2">
                      {task && (
                        <TaskPriorityBadge
                          priority={task.priority}
                          size="compact"
                        />
                      )}
                      <FiExternalLink
                        aria-hidden
                        className="text-black/35 transition group-hover:text-black/70 dark:text-white/35 dark:group-hover:text-white/75"
                      />
                    </span>
                  </div>
                  <h3 className="mt-3 font-semibold leading-snug">
                    {item.title}
                  </h3>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-black/60 dark:text-white/60">
                    {status && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-black/75 dark:text-white/75">
                        <i
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        {status.name}
                      </span>
                    )}
                    {project && (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <FiFolder className="shrink-0" aria-hidden />
                        <span className="truncate">{project.name}</span>
                      </span>
                    )}
                    {task?.due_time && (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <FiClock className="shrink-0" aria-hidden />
                        <time dateTime={task.due_time}>
                          {displayTime(task.due_time)}{" "}
                          {workspaceTimeZoneLabel(
                            task.due_date ?? taskSummary.date,
                          )}
                        </time>
                      </span>
                    )}
                    {assignees.length > 0 ? (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span className="flex shrink-0 -space-x-1.5">
                          {assignees.slice(0, 3).map((person) => (
                            <Avatar
                              key={person.id}
                              name={profileDisplayName(person)}
                              src={person.avatar_url}
                              size="sm"
                            />
                          ))}
                        </span>
                        <span className="truncate">
                          {assignees
                            .map((person) => profileDisplayName(person))
                            .join(", ")}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <FiUsers aria-hidden />
                        Unassigned
                      </span>
                    )}
                    {subtasks.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-black/55 dark:text-white/55">
                        <span aria-hidden>✓</span>
                        {completedSubtasks}/{subtasks.length}
                        <span className="sr-only">
                          checklist items complete
                        </span>
                      </span>
                    )}
                  </div>
                  {task && categories.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {categories.slice(0, 3).map((category) => (
                        <TaskCategoryBadge
                          key={category.id}
                          category={category}
                          tags={task.category_tags?.[category.id]}
                        />
                      ))}
                      {categories.length > 3 && (
                        <Pill size="sm">+{categories.length - 3}</Pill>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
        </div>
      </Modal>

      <CalendarEventEditorModal
        categories={data.categories}
        currentProfileId={data.currentProfile.id}
        editor={editor}
        googleEmail={googleConnection.email}
        googleSyncAvailable={googleSyncAvailable}
        previewing={previewing}
        profiles={data.profiles}
        projects={data.projects}
      />
    </>
  );
}
