// Components
import { Heading, Text, Card, StatCard, StatGrid } from "@ryanmeetup/ui";
import NextLink from "next/link";
import { getLocationStats } from "@/utils/stats";
import { contactHrefs } from "@/utils/contact";

// Types
import { Location } from "@/lib/types";

type InfoProps = {
  locations: Location[];
};

const Info = (props: InfoProps) => {
  const { locations } = props;

  const { cityCount, countryCount } = getLocationStats(locations);
  const locationTypeCounts: Record<string, number> = {
    "Event Location": 0,
    "Community Event": 0,
    "Ryan Hub": 0,
    "Ryan-Named Business": 0,
    "Ryan-Owned Business": 0,
    Chapter: 0,
  };

  locations?.forEach((location) => {
    if (locationTypeCounts[location.locationType] !== undefined) {
      locationTypeCounts[location.locationType] += 1;
    }
  });

  const stats = [
    { label: "Locations", value: locations.length },
    { label: "Cities & Regions", value: cityCount },
    { label: "Countries & Territories", value: countryCount },
    {
      label: "Event Locations",
      value:
        locationTypeCounts["Event Location"] +
        locationTypeCounts["Community Event"],
    },
    { label: "Chapters", value: locationTypeCounts["Chapter"] },
    {
      label: "Businesses",
      value:
        locationTypeCounts["Ryan-Named Business"] +
        locationTypeCounts["Ryan-Owned Business"],
    },
  ];

  return (
    <section className="px-4 pb-12 pt-6">
      <Card
        variant="soft"
        size="lg"
        className="mx-auto max-w-5xl text-center bg-white/90 ring-1 ring-black/10 dark:bg-white/5 dark:ring-white/10"
      >
        <Heading
          className="text-3xl title text-black sm:text-4xl dark:text-white"
          size="h2"
        >
          Ryan Meetup Worldwide
        </Heading>
        <Text className="mt-3 text-base text-black/70 dark:text-white/70">
          Our growing network of Ryans spans across{" "}
          <span className="font-semibold text-blue-700 dark:text-blue-500">
            {countryCount} countries and territories
          </span>{" "}
          and{" "}
          <span className="font-semibold text-blue-700 dark:text-blue-500">
            {cityCount} cities and regions
          </span>{" "}
          worldwide.
        </Text>
        <Text className="mt-3 text-base text-black/70 dark:text-white/70">
          Help us expand as we gear up for RyanCon, the soon-to-be largest same
          name gathering in history.
        </Text>

        <StatGrid className="mt-6">
          {stats.map((stat) => (
            <StatCard
              key={stat.label}
              value={stat.value}
              label={stat.label}
              className="bg-white/90 ring-1 ring-black/10 dark:bg-white/5 dark:ring-white/10"
            />
          ))}
        </StatGrid>

        <Heading
          className="mt-8 text-2xl title text-black sm:text-3xl dark:text-white"
          size="h3"
        >
          Don&apos;t see your city?
        </Heading>
        <Text className="mt-3 text-base text-black/70 dark:text-white/70">
          <NextLink
            href={contactHrefs.mapUpdate}
            className="font-semibold underline underline-offset-2 text-blue-700 hover:cursor-pointer hover:text-blue-800 dark:text-blue-500 dark:hover:text-blue-400"
          >
            Contact Ryan
          </NextLink>{" "}
          to have your city added to the map.
        </Text>
      </Card>
    </section>
  );
};

export { Info };
