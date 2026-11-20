import NextImage from "next/image";
import type { ReactNode } from "react";
import { Button, Card, Heading } from "@ryanmeetup/ui";
import {
  FiArrowUpRight,
  FiCalendar,
  FiCompass,
  FiMapPin,
} from "react-icons/fi";
import { MdStadium } from "react-icons/md";

import type { BaseballTeam } from "@/lib/types";
import {
  formatGameDate,
  getStateName,
  getTeamLogoSrc,
  hasTicketLink,
} from "@/utils/baseball";

type TeamCardProps = {
  team: BaseballTeam;
  distance?: number;
  /** Notes the team covers the selected state or city rather than sitting in it. */
  servesNote?: string;
};

type DetailProps = {
  icon: ReactNode;
  label: string;
  children: ReactNode;
};

/** One icon-led fact. The icon is decorative; the visually hidden label names the field. */
const Detail = ({ icon, label, children }: DetailProps) => (
  <p className="flex min-w-0 items-center gap-1.5">
    <span aria-hidden className="shrink-0 text-black/50 dark:text-white/50">
      {icon}
    </span>
    <span className="sr-only">{label}: </span>
    <span className="min-w-0">{children}</span>
  </p>
);

const TeamCard = ({ team, distance, servesNote }: TeamCardProps) => {
  const logo = getTeamLogoSrc(team);
  const ticketsReady = hasTicketLink(team);

  return (
    <Card size="md" className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-4">
        {/* Sized to match the date, name, and detail rows beside it. A
            stretched aspect-square can't size its own width in a flex row. */}
        <div className="relative size-24 shrink-0 overflow-hidden sm:size-28 rounded-xl border border-black/10 bg-white dark:border-white/10">
          {logo && (
            <NextImage
              src={logo}
              alt=""
              fill
              sizes="(min-width: 640px) 112px, 96px"
              className="object-contain p-2"
            />
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-caps text-black/70 dark:text-white/70">
            <FiCalendar
              aria-hidden
              className="shrink-0 text-black/50 dark:text-white/50"
            />
            {formatGameDate(team.gameDate)}
          </p>
          <Heading size="h3" className="text-lg leading-tight">
            {team.name}
          </Heading>
          <div className="flex flex-col gap-1 pt-1 text-sm text-black/70 dark:text-white/70">
            {team.venue && (
              <Detail icon={<MdStadium />} label="Stadium">
                {team.venue}
              </Detail>
            )}
            <Detail icon={<FiMapPin />} label="City">
              {team.city}, {getStateName(team.state)}
            </Detail>
            {(distance !== undefined || servesNote) && (
              <Detail icon={<FiCompass />} label="Distance">
                {[
                  distance !== undefined
                    ? `${Math.round(distance)} mi away`
                    : null,
                  servesNote,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Detail>
            )}
          </div>
        </div>
      </div>
      {ticketsReady ? (
        <Button.Link
          href={team.ticketUrl}
          newTab
          fullWidth
          className="sm:w-auto"
          rightIcon={<FiArrowUpRight aria-hidden />}
          aria-label={`Tickets for ${team.name} (opens in a new tab)`}
        >
          Tickets
        </Button.Link>
      ) : (
        <Button
          disabled
          fullWidth
          className="sm:w-auto"
          aria-label={`Tickets for ${team.name} aren't on sale yet`}
        >
          Tickets soon
        </Button>
      )}
    </Card>
  );
};

export { TeamCard };
