// Components
import NextImage from "next/image";
import NextLink from "next/link";
import { Heading, Text } from "@ryanmeetup/ui";
import { FaInstagram as Instagram } from "react-icons/fa";

// Types
import type { ChampionRyan } from "@/lib/types";

// Utilities
import { convertImageUrl } from "@ryanmeetup/utils";
import { formatEventLabel } from "@/utils/date";

type ChampionProps = {
  ryan: ChampionRyan;
};

const Champion = (props: ChampionProps) => {
  const {
    fullName,
    fullName2,
    headshot,
    eventDate,
    date,
    instagram,
    instagram2,
    title,
    location,
    location2,
  } = props.ryan;
  const displayDate = formatEventLabel({ date, eventDate });

  const imageUrl = convertImageUrl(headshot);

  return (
    <div className="group rounded-2xl border border-black/10 bg-white/90 p-6 text-center shadow-drop transition hover:-translate-y-1 hover:border-black/30 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/40">
      <div className="relative mx-auto mb-5 h-72 w-72 overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/10">
        <NextImage
          className="rounded-full"
          src={imageUrl ?? "/trophy.png"}
          fill={true}
          alt={fullName}
          style={{ objectFit: "cover" }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Heading className="text-3xl title leading-tight" size="h3">
          {fullName}
          {fullName2 && ` & ${fullName2}`}
        </Heading>
        {(instagram || instagram2) && (
          <div className="inline-flex items-center gap-2">
            {instagram && (
              <NextLink
                href={instagram}
                aria-label={`${fullName}'s Instagram`}
                className="inline-flex items-center justify-center rounded-full p-1 transition hover:bg-blue-500/15"
              >
                <Instagram className="h-4 w-4 dark:fill-white fill-black transition hover:fill-blue-500" />
              </NextLink>
            )}
            {instagram2 && (
              <NextLink
                href={instagram2}
                aria-label={`${fullName2}'s Instagram`}
                className="inline-flex items-center justify-center rounded-full p-1 transition hover:bg-blue-500/15"
              >
                <Instagram className="h-4 w-4 dark:fill-white fill-black transition hover:fill-blue-500" />
              </NextLink>
            )}
          </div>
        )}
      </div>
      <Heading
        className="mt-3 text-xl dark:text-white text-black tracking-caps-wide"
        size="h4"
      >
        {title}
      </Heading>
      <Text className="mt-2 text-sm text-black/70 dark:text-white/70">
        {location} {location2 && `, & ${location2} `}• {displayDate}
      </Text>
    </div>
  );
};

export { Champion };
