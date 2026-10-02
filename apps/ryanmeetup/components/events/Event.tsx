// Components
import NextLink from "next/link";
import NextImage from "next/image";
import { Heading, Text } from "@ryanmeetup/ui";
import { FaCity as City } from "react-icons/fa";
import { FaCalendarDays as Calendar } from "react-icons/fa6";
import {
  FaCalendarCheck as CalendarCheck,
  FaArrowRight as ArrowRight,
} from "react-icons/fa6";
import { MdLocationPin as Pin } from "react-icons/md";

// Types
import type { ContentfulImage, RyanEvent } from "@/lib/types";

// Utilities
import { convertImageUrl } from "@ryanmeetup/utils";
import { formatEventDisplayDate, isEventUpcoming } from "@/utils/date";
import { getEventCtaLabel } from "@/utils/events";

type EventProps = {
  event: RyanEvent;
  fullDescription?: boolean;
};

const Event = (props: EventProps) => {
  const { fullDescription = false } = props;
  const { title, coverImage, description, href, city, dateTime, venue, date } =
    props.event;
  const isUpcoming = isEventUpcoming(date);
  const displayDate = formatEventDisplayDate({ date, dateTime });
  const upcomingCtaLabel = getEventCtaLabel(props.event, "RSVP");

  const imageUrl =
    typeof coverImage === "string"
      ? coverImage
      : convertImageUrl(coverImage as ContentfulImage);

  return (
    <NextLink href={href} className="group block h-full">
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/90 shadow-[0_25px_50px_-40px_rgba(0,0,0,0.6)] transition hover:-translate-y-1 hover:border-black/30 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/40">
        <div className="relative aspect-[2/1] w-full max-h-[450px] overflow-hidden border-b border-black/10 dark:border-white/10">
          <NextImage
            className="rounded-t-2xl"
            src={imageUrl ?? "/trophy.png"}
            fill={true}
            alt={title}
            sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
            style={{ objectFit: "cover" }}
          />
        </div>

        {/* Event Description */}
        <div className="flex flex-1 flex-col px-5 py-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="space-y-1">
              <Text className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-black/70 dark:text-white/70">
                <Calendar className="h-4 w-4" />
                {displayDate}
              </Text>
              <Heading className="text-2xl title" size="h3">
                {title}
              </Heading>
            </div>
          </div>
          <Text
            className={`text-sm text-black/70 dark:text-white/70 ${
              fullDescription
                ? ""
                : "min-h-[85px] overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]"
            }`}
          >
            {description}
          </Text>

          <div className="mt-auto gap-2 pt-5 text-black/70 dark:text-white/70">
            <div className="flex items-center gap-2">
              <City className="w-4 h-4" />
              <Text className="text-sm uppercase tracking-[0.2em]">{city}</Text>
            </div>

            <div className="flex items-center gap-2">
              <Pin className="w-4 h-4" />
              <Text className="text-sm uppercase tracking-[0.2em]">
                {venue}
              </Text>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3 border-t border-black/10 pt-4 text-black/70 dark:border-white/10 dark:text-white/70">
            <span
              className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition ${
                isUpcoming
                  ? "border border-black/70 bg-black text-white shadow-md group-hover:-translate-y-0.5 group-hover:border-black/90 group-hover:bg-black/90 dark:border-white/40 dark:bg-white dark:text-black dark:group-hover:border-white/70 dark:group-hover:bg-white/90"
                  : "border border-black/30 bg-black/5 text-black group-hover:-translate-y-0.5 group-hover:border-black/50 group-hover:bg-black/10 dark:border-white/30 dark:bg-white/10 dark:text-white dark:group-hover:border-white/60 dark:group-hover:bg-white/20"
              }`}
            >
              {isUpcoming ? (
                <>
                  <CalendarCheck className="h-4 w-4" />
                  {upcomingCtaLabel}
                </>
              ) : (
                <>
                  View event
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </NextLink>
  );
};

export { Event };
