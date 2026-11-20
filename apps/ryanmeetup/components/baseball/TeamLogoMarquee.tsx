import { LogoMarquee } from "@ryanmeetup/ui";

import type { BaseballTeam } from "@/lib/types";
import { getTeamLogoSrc } from "@/utils/baseball";

// Below this many logos the loop repeats so visibly it looks broken.
const MIN_LOGOS = 3;

type TeamLogoMarqueeProps = {
  teams: BaseballTeam[];
};

/**
 * Every announced team's logo, full width like the home page's sponsor rows.
 * Each logo jumps to that team in the finder.
 */
const TeamLogoMarquee = ({ teams }: TeamLogoMarqueeProps) => {
  const items = teams.flatMap((team) => {
    const src = getTeamLogoSrc(team);
    return src
      ? [
          {
            key: team.slug,
            src,
            alt: team.name,
            href: `/baseball?team=${encodeURIComponent(team.slug)}#find`,
            imageClassName: "h-16 sm:h-24",
            sizes: "(max-width: 640px) 128px, 192px",
          },
        ]
      : [];
  });
  if (items.length < MIN_LOGOS) return null;

  return (
    <LogoMarquee
      items={items}
      autoFill
      speed={40}
      // Team marks are drawn for a white ground and have no dark variant, so
      // keep the card white in dark mode. LogoCard's own dark:bg-white/5 sits
      // at the same specificity, hence the !important.
      itemClassName="mx-3 h-24 w-36 dark:bg-white! dark:hover:bg-white! sm:mx-4 sm:h-32 sm:w-48"
      wrapperClassName="py-2"
    />
  );
};

export { TeamLogoMarquee };
