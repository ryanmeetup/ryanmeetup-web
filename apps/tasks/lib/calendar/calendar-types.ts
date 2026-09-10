import type { Category, Project } from "@/lib/resources/resource-types";
import { projectPath } from "@/lib/resources/project-route";
import { taskPath } from "@/lib/tasks/task-key";
import type { Task } from "@/lib/tasks/task-types";
import type { Profile } from "@/lib/workspace/workspace-types";
import type { GoogleCalendarEvent } from "./google-calendar-types";
import {
  WORKSPACE_TIME_ZONE,
  workspaceGoogleEventIds,
} from "./google-calendar-sync";
import {
  occurrencesInRange,
  parseRecurrence,
  recurrenceShortLabel,
  type CalendarRecurrence,
} from "./calendar-recurrence";

export type CalendarEventKind = "important" | "away";

export type CalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  recurrence: CalendarRecurrence | null;
  project_id: string | null;
  category_id: string | null;
  profile_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export const CALENDAR_EVENT_COLUMNS =
  "id,kind,title,description,starts_at,ends_at,all_day,recurrence,project_id,category_id,profile_id,created_by,created_at,updated_at";

export type CalendarEventDraft = {
  id?: string;
  kind: CalendarEventKind;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  recurrence: CalendarRecurrence | null;
  projectId: string;
  categoryId: string;
  profileId: string;
  syncToGoogle: boolean;
};

export type CalendarItem = {
  id: string;
  source: "task" | CalendarEventKind | "google";
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  href?: string;
  task?: Task;
  event?: CalendarEvent;
  google?: GoogleCalendarEvent;
  // The date this occurrence of a repeating entry starts on. Entries that
  // happen once carry their own start date here as well.
  occurrence?: string;
  meta?: string;
  external?: boolean;
};

const datePart = (value: string) => value.slice(0, 10);
const timePart = (value: string) => value.slice(11, 16);

export function displayTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`1970-01-01T${value.slice(0, 5)}:00Z`));
}

// Every time on this calendar is the workspace zone's wall clock, which a Ryan
// reading from another city has no way to infer, so the zone is named wherever
// a time is. Noon UTC lands on the same day in the workspace zone, which keeps
// the label on the right side of a daylight-saving change.
export function workspaceTimeZoneLabel(
  date: string,
  style: "short" | "long" = "short",
) {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: WORKSPACE_TIME_ZONE,
      timeZoneName: style,
    })
      .formatToParts(new Date(`${date}T12:00:00Z`))
      .find((part) => part.type === "timeZoneName")?.value ?? ""
  );
}

// When something runs is the first thing a reader looks for, so timed entries
// lead with their hours. A range that crosses days cannot say anything useful
// on a single tile, so those show only when the entry starts.
function timeLabel(date: string, start?: string, end?: string, sameDay = true) {
  if (!start) return undefined;
  const hours =
    sameDay && end
      ? `${displayTime(start)} – ${displayTime(end)}`
      : displayTime(start);
  return `${hours} ${workspaceTimeZoneLabel(date)}`.trim();
}

const metaLabel = (...parts: (string | undefined)[]) =>
  parts.filter(Boolean).join(" · ") || undefined;

const sourceOrder: Record<CalendarItem["source"], number> = {
  away: 0,
  task: 1,
  important: 2,
  google: 3,
};

export function compareCalendarItems(left: CalendarItem, right: CalendarItem) {
  return (
    left.start.localeCompare(right.start) ||
    sourceOrder[left.source] - sourceOrder[right.source] ||
    left.title.localeCompare(right.title)
  );
}

/**
 * `range` bounds how far a repeating event is expanded. It should cover every
 * date the caller can draw, because an occurrence outside it is not produced.
 */
export function calendarItems(
  tasks: Task[],
  events: CalendarEvent[],
  projects: Project[],
  categories: Category[],
  profiles: Profile[] = [],
  googleEvents: GoogleCalendarEvent[] = [],
  range: { start: string; end: string },
): CalendarItem[] {
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const categoryMap = new Map(
    categories.map((category) => [category.id, category]),
  );
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const projectItems: CalendarItem[] = projects.flatMap((project) => {
    if (project.archived_at) return [];
    const href = projectPath(project, projects);
    const milestones: CalendarItem[] = [];
    if (project.start_date)
      milestones.push({
        id: `project:${project.id}:start`,
        source: "important",
        title: project.name,
        start: project.start_date,
        end: project.start_date,
        allDay: true,
        color: "#059669",
        href,
        meta: "Project starts",
      });
    if (project.due_date)
      milestones.push({
        id: `project:${project.id}:due`,
        source: "important",
        title: project.name,
        start: project.due_date,
        end: project.due_date,
        allDay: true,
        color: "#7c3aed",
        href,
        meta: "Project due",
      });
    return milestones;
  });
  const taskItems: CalendarItem[] = tasks.flatMap((task) => {
    if (!task.due_date || task.archived_at || task.completed_at) return [];
    const project = task.project_id
      ? projectMap.get(task.project_id)
      : undefined;
    return [
      {
        id: `task:${task.id}`,
        source: "task",
        title: task.title,
        start: task.due_date,
        end: task.due_date,
        allDay: !task.due_time,
        color: task.priority === "urgent" ? "#dc2626" : "#c026d3",
        href: taskPath(task),
        task,
        meta: project?.name ?? "Task deadline",
      },
    ];
  });
  const eventItems = events.flatMap((event): CalendarItem[] => {
    const project = event.project_id
      ? projectMap.get(event.project_id)
      : undefined;
    const category = event.category_id
      ? categoryMap.get(event.category_id)
      : undefined;
    const recurrence = parseRecurrence(event.recurrence);
    const color =
      event.kind === "away"
        ? "#d97706"
        : (category?.color ?? (project ? "#7c3aed" : "#059669"));
    const owner =
      event.kind === "away"
        ? `${profileMap.get(event.profile_id ?? "")?.full_name ?? "A teammate"} · Away`
        : (project?.name ?? category?.name);
    const sameDay = datePart(event.starts_at) === datePart(event.ends_at);
    return occurrencesInRange(
      {
        startDate: datePart(event.starts_at),
        endDate: datePart(event.ends_at),
        recurrence: event.recurrence,
      },
      range,
    ).map((occurrence) => ({
      // Every occurrence of a series shares one workspace row, so the date it
      // falls on is what makes a tile distinct.
      id: `event:${event.id}:${occurrence.start}`,
      source: event.kind,
      title: event.title,
      start: occurrence.start,
      end: occurrence.end,
      allDay: event.all_day,
      color,
      event,
      occurrence: occurrence.start,
      // The zone label is read from the occurrence, so a repeat that crosses a
      // daylight-saving boundary still names the offset that date runs in.
      meta: metaLabel(
        event.all_day
          ? undefined
          : timeLabel(
              occurrence.start,
              timePart(event.starts_at),
              timePart(event.ends_at),
              sameDay,
            ),
        owner,
        recurrenceShortLabel(recurrence),
      ),
    }));
  });
  // A published workspace date comes back from Google as well; the workspace
  // row owns it, so the imported copy is dropped instead of shown twice.
  const publishedIds = workspaceGoogleEventIds(events);
  const googleItems = googleEvents
    // A published series arrives one instance at a time, each naming the event
    // the workspace row owns.
    .filter((event) => !publishedIds.has(event.recurringEventId ?? event.id))
    .map((event): CalendarItem => ({
      id: `google:${event.id}`,
      source: "google",
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      color: "#2563eb",
      // The tile opens the details dialog rather than leaving for Google, so
      // everything the invite carries is readable without a round trip. Google
      // stays one button away inside it.
      google: event,
      // Every imported event comes from the one connected calendar, so naming
      // it on each tile says nothing the blue styling has not already said.
      meta: event.allDay
        ? undefined
        : timeLabel(
            event.start,
            event.startTime,
            event.endTime,
            event.start === event.end,
          ),
    }));
  return [...projectItems, ...taskItems, ...eventItems, ...googleItems].sort(
    compareCalendarItems,
  );
}

export function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - first.getUTCDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setUTCDate(gridStart.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
  return { days, year, monthNumber };
}

export function itemsOnDate(items: CalendarItem[], date: string) {
  return items
    .filter((item) => item.start <= date && item.end >= date)
    .sort(compareCalendarItems);
}
