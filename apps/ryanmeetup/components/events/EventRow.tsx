"use client";

import NextImage from "next/image";
import NextLink from "next/link";
import { Heading, Kicker } from "@ryanmeetup/ui";
import { FaArrowRight as ArrowRight } from "react-icons/fa6";
import { formatEventLocationLabel, formatMonthDay } from "@/utils/date";
import { getEventCtaLabel } from "@/utils/events";
import type { RyanEvent } from "@/lib/types";

type EventRowProps = {
  event: RyanEvent;
  ctaLabel: string;
  className?: string;
};

const EventRow = (props: EventRowProps) => {
  const { event, ctaLabel, className } = props;
  const date = formatMonthDay(event.date);
  const isNationalEvent = event.chapter.includes("Main");
  const chapterTags = Array.from(
    new Set(event.chapter.filter((item) => item !== "Main")),
  );
  const maxChapterBadges = 1;
  const visibleChapterTags = chapterTags.slice(0, maxChapterBadges);
  const remainingChapterCount = Math.max(
    0,
    chapterTags.length - maxChapterBadges,
  );
  const isPartiful =
    typeof event.href === "string" && event.href.includes("partiful.com");
  const resolvedCtaLabel = getEventCtaLabel(event, ctaLabel);
  const resolvedCtaKey = resolvedCtaLabel.toLowerCase();
  const isViewEvent = resolvedCtaKey === "view event";
  const showPartifulRsvp = isPartiful && resolvedCtaKey === "rsvp";

  return (
    <NextLink
      href={event.href}
      className={`group flex flex-col gap-4 rounded-2xl border border-black/10 bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5 hover:shadow-md dark:border-white/15 dark:bg-white/5 dark:hover:border-white/30 dark:hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between ${
        className ?? ""
      }`}
    >
      <div className="flex items-start gap-3 sm:items-center sm:gap-4">
        <div className="mt-0.5 flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-xl border border-black/10 bg-black/5 px-2 py-1.5 text-black dark:border-white/10 dark:bg-white/10 dark:text-white sm:mt-0 sm:h-12 sm:w-12 sm:px-0 sm:py-0">
          <span className="text-[10px] font-semibold uppercase tracking-caps text-black/70 dark:text-white/70">
            {date.month}
          </span>
          <span className="text-lg font-semibold">{date.day}</span>
        </div>
        <div className="space-y-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
            <Heading
              className="order-2 text-base title sm:order-1 sm:text-lg"
              size="h3"
            >
              {event.title}
            </Heading>
            {(isNationalEvent || chapterTags.length > 0) && (
              <div className="order-1 flex flex-wrap items-center gap-2 sm:order-2">
                {isNationalEvent && (
                  <span className="inline-flex items-center rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-caps text-amber-700 shadow-sm dark:border-amber-300/60 dark:bg-amber-300/20 dark:text-amber-200">
                    National Event
                  </span>
                )}
                {visibleChapterTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-caps text-emerald-700 shadow-sm dark:border-emerald-300/40 dark:bg-emerald-300/15 dark:text-emerald-200"
                  >
                    {tag} Chapter
                  </span>
                ))}
                {remainingChapterCount > 0 && (
                  <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-caps text-emerald-700/80 shadow-sm dark:border-emerald-300/30 dark:bg-emerald-300/10 dark:text-emerald-200/80">
                    +{remainingChapterCount} more
                  </span>
                )}
              </div>
            )}
          </div>
          <Kicker className="!tracking-caps-tight sm:!tracking-caps">
            {formatEventLocationLabel(event, "en-US", false)}
            <span className="hidden sm:inline"> • {event.venue}</span>
          </Kicker>
        </div>
      </div>
      <span className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-black/20 px-3 py-2 text-xs font-semibold text-black transition group-hover:border-black/40 group-hover:bg-black/5 dark:border-white/20 dark:text-white dark:group-hover:border-white/40 dark:group-hover:bg-white/10 sm:w-auto">
        {showPartifulRsvp && (
          <NextImage
            src="/icons/partiful.webp"
            alt="Partiful"
            width={16}
            height={16}
            className="h-4 w-4"
          />
        )}
        {showPartifulRsvp ? "RSVP on Partiful" : resolvedCtaLabel}
        {isViewEvent && <ArrowRight className="h-3.5 w-3.5" />}
      </span>
    </NextLink>
  );
};

export { EventRow };
