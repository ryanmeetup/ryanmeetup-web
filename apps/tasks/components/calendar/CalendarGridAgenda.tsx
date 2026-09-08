"use client";

import type { ReactNode } from "react";
import {
  AnimatedCollapse,
  Button,
  Card,
  DropdownSelect,
  EmptyState,
  Spinner,
} from "@ryanmeetup/ui";
import {
  FiArrowLeft,
  FiArrowRight,
  FiCalendar,
  FiClock,
  FiInfo,
  FiSidebar,
} from "react-icons/fi";
import type { CalendarItem } from "@/lib/calendar/calendar-types";
import { itemsOnDate } from "@/lib/calendar/calendar-types";
import { moveCalendarMonth } from "@/lib/calendar/calendar-view";
import type { GoogleCalendarConnection } from "@/lib/calendar/google-calendar-types";

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SyncingItems({ rows }: { rows: number }) {
  return (
    <div className="space-y-1" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={`syncing:${index}`}
          className="h-9 animate-pulse rounded-md border-l-4 border-blue-500/25 bg-black/[0.05] motion-reduce:animate-none dark:border-blue-400/25 dark:bg-white/[0.07]"
        />
      ))}
    </div>
  );
}

function SyncingNote({ className = "" }: { className?: string }) {
  return (
    <p
      className={`flex items-center gap-2 text-xs font-semibold text-blue-800 dark:text-blue-200 ${className}`}
    >
      <Spinner size={14} label="Syncing Google Calendar" />
      Syncing Google events…
    </p>
  );
}

function SyncingBanner() {
  return (
    <div className="relative mb-3 overflow-hidden rounded-xl border border-blue-500/30 bg-blue-500/[0.08] px-3 py-2.5 dark:border-blue-400/30 dark:bg-blue-400/[0.12]">
      <SyncingNote className="text-sm" />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 block h-0.5 overflow-hidden"
      >
        <span className="block h-full w-1/4 animate-sync-sweep rounded-full bg-blue-600/80 motion-reduce:w-full motion-reduce:animate-none dark:bg-blue-300/80" />
      </span>
    </div>
  );
}

export function CalendarGridAgenda({
  agendaDates,
  calendarSidebarOpen,
  days,
  googleCanView,
  googleConnection,
  googleSyncing,
  initialMonth,
  items,
  month,
  monthItems,
  monthNumber,
  onOpenNew,
  onToggleSidebar,
  renderDayItems,
  setMonth,
  setSource,
  source,
  today,
  upcomingDates,
}: {
  agendaDates: string[];
  calendarSidebarOpen: boolean;
  days: string[];
  googleCanView: boolean;
  googleConnection: GoogleCalendarConnection;
  googleSyncing: boolean;
  initialMonth: string;
  items: CalendarItem[];
  month: string;
  monthItems: CalendarItem[];
  monthNumber: number;
  onOpenNew: (date: string) => void;
  onToggleSidebar: () => void;
  renderDayItems: (
    date: string,
    items: CalendarItem[],
    limit?: number,
  ) => ReactNode;
  setMonth: (month: string) => void;
  setSource: (source: string) => void;
  source: string;
  today: string;
  upcomingDates: string[];
}) {
  return (
    <div
      className={`grid transition-[grid-template-columns,gap] duration-300 ease-out motion-reduce:transition-none ${
        calendarSidebarOpen
          ? "gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]"
          : "gap-0 xl:grid-cols-[minmax(0,1fr)_0rem]"
      }`}
    >
      <section className="min-w-0">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* On a phone this row owns the full width, so the arrows sit at
              the edges with the month centered between them. */}
          <div className="flex items-center justify-between gap-2 sm:justify-start">
            <Button
              size="xs"
              variant="secondary"
              aria-label="Previous month"
              onClick={() => setMonth(moveCalendarMonth(month, -1))}
            >
              <FiArrowLeft />
            </Button>
            <h2 className="min-w-44 flex-1 text-center text-lg font-semibold sm:flex-none">
              {monthFormatter.format(new Date(`${month}-01T00:00:00Z`))}
            </h2>
            <Button
              size="xs"
              variant="secondary"
              aria-label="Next month"
              onClick={() => setMonth(moveCalendarMonth(month, 1))}
            >
              <FiArrowRight />
            </Button>
          </div>
          {/* One tidy row on a phone: the filter takes the slack, Today keeps
              its own width. From `sm` up they sit with the rest, right of the
              month. */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <DropdownSelect
              className="h-9"
              label="Show"
              value={source}
              onChange={setSource}
              options={[
                { label: "Everything", value: "all" },
                { label: "Deadlines", value: "task" },
                { label: "Time away", value: "away" },
                { label: "Important dates", value: "important" },
                ...(googleCanView && googleConnection.connected
                  ? [{ label: "Google Calendar", value: "google" }]
                  : []),
              ]}
            />
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<FiCalendar />}
              onClick={() => setMonth(initialMonth)}
            >
              Today
            </Button>
            {/* The details rail only earns its space next to the month grid.
                On a phone the agenda below already lists every item in the
                month, so the toggle and the rail both stop at `md`. The
                wrapper carries the breakpoint because `hidden` on the button
                itself would race the `inline-flex` in its own base classes. */}
            <span className="hidden md:inline-flex">
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<FiSidebar />}
                aria-expanded={calendarSidebarOpen}
                aria-controls="calendar-details"
                onClick={onToggleSidebar}
              >
                {calendarSidebarOpen ? "Hide details" : "Show details"}
              </Button>
            </span>
          </div>
        </div>
        {googleSyncing && <SyncingBanner />}
        <div
          data-calendar-month-grid
          className="hidden overflow-hidden rounded-xl border border-black/10 dark:border-white/10 md:block"
          aria-busy={googleSyncing}
        >
          <div className="grid grid-cols-7 border-b border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.04]">
            {weekdays.map((day) => (
              <div
                key={day}
                className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-black/55 dark:text-white/55"
              >
                {day}
              </div>
            ))}
          </div>
          <div
            className={`grid grid-cols-7 transition-opacity ${googleSyncing ? "opacity-60" : ""}`}
          >
            {days.map((date) => {
              const dateItems = itemsOnDate(items, date);
              const inMonth = Number(date.slice(5, 7)) === monthNumber;
              return (
                <div
                  key={date}
                  className={`min-h-28 border-b border-r border-black/10 p-1.5 last:border-r-0 dark:border-white/10 ${inMonth ? "bg-white/60 dark:bg-white/[0.015]" : "bg-black/[0.025] text-black/40 dark:bg-black/10 dark:text-white/35"}`}
                >
                  <button
                    type="button"
                    onClick={() => onOpenNew(date)}
                    aria-label={`Add an item on ${date}`}
                    className={`mb-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:hover:bg-white/10 dark:focus-visible:ring-white/40 ${date === today ? "bg-black text-white dark:bg-white dark:text-black" : ""}`}
                  >
                    {Number(date.slice(8))}
                  </button>
                  <div className="space-y-1">
                    {renderDayItems(date, dateItems)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div
          data-calendar-mobile-agenda
          className="space-y-3 md:hidden"
          aria-busy={googleSyncing}
        >
          {agendaDates.length ? (
            agendaDates.map((date) => (
              <div
                key={date}
                className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3"
              >
                <p className="pt-2 text-xs font-semibold text-black/60 dark:text-white/60">
                  {dayFormatter.format(new Date(`${date}T00:00:00Z`))}
                </p>
                <div className="space-y-2">
                  {renderDayItems(
                    date,
                    itemsOnDate(monthItems, date),
                    Number.POSITIVE_INFINITY,
                  )}
                </div>
              </div>
            ))
          ) : googleSyncing ? (
            <SyncingItems rows={3} />
          ) : (
            <EmptyState message="Nothing scheduled this month. A suspiciously peaceful calendar." />
          )}
        </div>
      </section>
      {/* Same reason as the toggle: the wrapper hides the rail below `md`,
          since the collapse sets `grid` on itself. */}
      <div className="hidden min-w-0 md:block">
        <AnimatedCollapse
          id="calendar-details"
          open={calendarSidebarOpen}
          className="min-w-0"
          contentClassName="min-w-0"
        >
          <aside className="space-y-4" aria-label="Calendar details">
            <Card className="p-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <FiClock /> Coming up
                {googleSyncing && (
                  <Spinner
                    size={14}
                    label="Syncing Google Calendar"
                    className="text-blue-700 dark:text-blue-300"
                  />
                )}
              </h2>
              {/* The list scrolls, so it is fenced top and bottom: rows fade
                  into a rule instead of clipping into nothing. */}
              <div
                className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto border-y border-black/10 py-3 pr-1 dark:border-white/10"
                aria-busy={googleSyncing}
              >
                {upcomingDates.slice(0, 6).map((date) => (
                  <div key={`upcoming:${date}`} className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50 dark:text-white/50">
                      {dayFormatter.format(new Date(`${date}T00:00:00Z`))}
                    </p>
                    {renderDayItems(date, itemsOnDate(monthItems, date), 2)}
                  </div>
                ))}
                {googleSyncing && (
                  <SyncingItems rows={upcomingDates.length ? 1 : 3} />
                )}
                {!upcomingDates.length && !googleSyncing && (
                  <p className="text-sm text-black/60 dark:text-white/60">
                    {monthItems.length
                      ? "Nothing left this month. Check a later month for what is next."
                      : "Nothing on the books this month."}
                  </p>
                )}
              </div>
            </Card>
            <Card className="p-4" aria-label="Calendar source key">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <FiInfo /> Calendar key
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-black/70 dark:text-white/70">
                <span className="flex items-center gap-2">
                  <i className="h-2.5 w-2.5 rounded-sm bg-fuchsia-600 dark:bg-fuchsia-400" />
                  Deadlines
                </span>
                <span className="flex items-center gap-2">
                  <i className="h-2.5 w-2.5 rounded-sm bg-blue-600 dark:bg-blue-400" />
                  Google
                </span>
                <span className="flex items-center gap-2">
                  <i className="h-2.5 w-2.5 rounded-sm bg-amber-600 dark:bg-amber-400" />
                  Away
                </span>
                <span className="flex items-center gap-2">
                  <i className="h-2.5 w-2.5 rounded-sm bg-[linear-gradient(135deg,#059669_0_50%,#7c3aed_50%)]" />
                  Dates
                </span>
              </div>
            </Card>
          </aside>
        </AnimatedCollapse>
      </div>
    </div>
  );
}
