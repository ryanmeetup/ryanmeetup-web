import NextImage from "next/image";
import { Button, Card, Heading } from "@ryanmeetup/ui";
import { FiArrowUpRight } from "react-icons/fi";

import type { BaseballTeam } from "@/lib/types";
import { formatGameDate, getStateName, getTeamLogoSrc } from "@/utils/baseball";

type TeamCardProps = {
  team: BaseballTeam;
  distance?: number;
  /** Notes the team covers the selected state or city rather than sitting in it. */
  servesNote?: string;
};

const TeamCard = ({ team, distance, servesNote }: TeamCardProps) => {
  const logo = getTeamLogoSrc(team);

  return (
    <Card size="md" className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10">
          {logo && (
            <NextImage
              src={logo}
              alt=""
              fill
              sizes="64px"
              className="object-contain p-1.5"
            />
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-caps text-black/70 dark:text-white/70">
            {formatGameDate(team.gameDate)}
          </p>
          <Heading size="h3" className="text-lg leading-tight">
            {team.name}
          </Heading>
          <p className="text-sm text-black/70 dark:text-white/70">
            {[team.venue, `${team.city}, ${getStateName(team.state)}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {(distance !== undefined || servesNote) && (
            <p className="text-xs text-black/70 dark:text-white/70">
              {[
                distance !== undefined ? `${Math.round(distance)} mi away` : null,
                servesNote,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      </div>
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
    </Card>
  );
};

export { TeamCard };
