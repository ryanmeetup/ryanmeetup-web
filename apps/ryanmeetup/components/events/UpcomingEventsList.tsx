"use client";

import { Transition } from "@headlessui/react";
import { Card } from "@ryanmeetup/ui";
import { Event, EventRow, EventsSectionHeader } from "@/components/events";
import { formatEventCount, sortEventsByDate } from "@/utils/date";

import type { RyanEvent } from "@/lib/types";

type UpcomingEventsListProps = {
  events: RyanEvent[];
  title?: string;
  sortOrder?: "asc" | "desc";
  ctaLabel?: string;
  displayMode?: "summary" | "details";
  isLoading?: boolean;
  headerMeta?: React.ReactNode;
  headerAction?: React.ReactNode;
};

const UpcomingEventsList = (props: UpcomingEventsListProps) => {
  const {
    events,
    title = "Upcoming Events",
    sortOrder = "asc",
    ctaLabel = "RSVP",
    displayMode = "summary",
    isLoading = false,
    headerMeta,
    headerAction,
  } = props;

  if (isLoading) {
    return (
      <Card variant="solid" size="md" className="mb-10">
        <div className="mb-4 flex flex-col gap-2 text-center lg:flex-row lg:items-end lg:justify-between lg:text-left">
          <div className="h-9 w-56 rounded-full bg-black/10 animate-pulse dark:bg-white/10" />
          <div className="h-4 w-24 rounded-full bg-black/10 animate-pulse dark:bg-white/10" />
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`event-skeleton-${index}`}
              className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white px-4 py-3 dark:border-white/15 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                <div className="h-12 w-12 rounded-xl bg-black/10 animate-pulse dark:bg-white/10" />
                <div className="space-y-2">
                  <div className="h-4 w-48 rounded-full bg-black/10 animate-pulse dark:bg-white/10" />
                  <div className="h-3 w-40 rounded-full bg-black/10 animate-pulse dark:bg-white/10" />
                </div>
              </div>
              <div className="h-9 w-32 rounded-full bg-black/10 animate-pulse dark:bg-white/10" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (events.length === 0) return null;
  const sortedEvents = sortEventsByDate(events, sortOrder);
  const meta = headerMeta ?? formatEventCount(events.length);

  if (displayMode === "details") {
    return (
      <div className="mb-10 space-y-4">
        <EventsSectionHeader title={title} meta={meta} action={headerAction} />
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 pt-1 md:grid-cols-2 xl:grid-cols-3">
          {sortedEvents.map((event, index) => (
            <Transition
              key={`${event.title}-${event.date}`}
              appear={true}
              show={true}
              enter="transition duration-700 ease-out"
              enterFrom="opacity-0 translate-y-4"
              enterTo="opacity-100 translate-y-0"
              as="div"
              className={`h-full ${
                index === 0
                  ? "delay-75"
                  : index === 1
                    ? "delay-150"
                    : index === 2
                      ? "delay-200"
                      : index === 3
                        ? "delay-300"
                        : "delay-500"
              }`}
            >
              <Event event={event} fullDescription />
            </Transition>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card variant="solid" size="md" className="mb-10">
      <EventsSectionHeader
        className="mb-4"
        title={title}
        meta={meta}
        action={headerAction}
      />
      <div className="grid gap-3">
        {sortedEvents.map((event, index) => {
          const delayClass =
            index === 0
              ? "delay-75"
              : index === 1
                ? "delay-150"
                : index === 2
                  ? "delay-200"
                  : index === 3
                    ? "delay-300"
                    : "delay-500";
          return (
            <Transition
              key={`${event.title}-${event.date}`}
              appear={true}
              show={true}
              enter="transition duration-700 ease-out"
              enterFrom="opacity-0 translate-y-4"
              enterTo="opacity-100 translate-y-0"
              as="div"
              className={delayClass}
            >
              <EventRow event={event} ctaLabel={ctaLabel} />
            </Transition>
          );
        })}
      </div>
    </Card>
  );
};

export { UpcomingEventsList };
