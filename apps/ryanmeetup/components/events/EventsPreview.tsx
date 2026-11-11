"use client";

import { useQueryParamState } from "@ryanmeetup/hooks";
import { Heading, Text } from "@ryanmeetup/ui";
import { EventsListPager } from "@/components/events/EventsListPager";
import type { RyanEvent } from "@/lib/types";

type EventsPreviewProps = {
  events: RyanEvent[];
};

const EventsPreview = (props: EventsPreviewProps) => {
  const { events } = props;
  const [viewParam, setView] = useQueryParamState("event-view", "upcoming");
  const view: "upcoming" | "past" =
    viewParam === "past" ? "past" : "upcoming";
  const pageSize = 5;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 text-center lg:flex-row lg:items-center lg:justify-between lg:text-left">
        <div>
          <Heading className="text-3xl title lg:text-4xl" size="h2">
            Events Overview
          </Heading>
          <Text className="text-sm text-black/70 dark:text-white/70">
            See what&apos;s coming up — or browse past meetups.
          </Text>
        </div>
        <div className="inline-flex items-center justify-center gap-2 self-center rounded-full border border-black/10 bg-white/80 p-1 shadow-sm dark:border-white/10 dark:bg-white/10 lg:self-auto">
          <button
            type="button"
            onClick={() => {
              setView("upcoming");
            }}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-caps transition ${
              view === "upcoming"
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "text-black/70 hover:text-black dark:text-white/70 dark:hover:text-white"
            }`}
            aria-pressed={view === "upcoming"}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => {
              setView("past");
            }}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-caps transition ${
              view === "past"
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "text-black/70 hover:text-black dark:text-white/70 dark:hover:text-white"
            }`}
            aria-pressed={view === "past"}
          >
            Past
          </button>
        </div>
      </div>

      <EventsListPager
        events={events}
        view={view}
        pageSize={pageSize}
        perPageOptions={[5, 10, 25]}
        defaultPerPage={pageSize}
        showPerPageSelector
        listTitle={view === "upcoming" ? "Upcoming Events" : "Past Events"}
        ctaLabel={view === "upcoming" ? "RSVP" : "View event"}
        sortOrder={view === "upcoming" ? "asc" : "desc"}
        resetKey={view}
      />
    </section>
  );
};

export { EventsPreview };
