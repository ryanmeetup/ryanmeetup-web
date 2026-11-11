// Components
import { Heading, Text } from "@ryanmeetup/ui";
import NextLink from "next/link";

type MissionProps = {
  hrefStyles: string;
};

// TODO: Let's add more info about our elusive enemy, the Ivans.
const Mission = (props: MissionProps) => {
  const { hrefStyles } = props;

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:gap-10 xl:py-10">
      <div className="lg:col-span-4">
        <Heading
          className="text-3xl title sm:text-4xl lg:text-5xl"
          size="h2"
        >
          Set a world record, spark a global community.
        </Heading>
      </div>
      <div className="space-y-4 lg:col-span-8">
        <Text className="text-lg sm:text-xl">
          At RyanCon, we intend to break the world record for the{" "}
          <NextLink
            href="https://www.guinnessworldrecords.com/world-records/largest-same-name-gathering-first-name"
            className={hrefStyles}
          >
            largest same name gathering
          </NextLink>
          , which is currently held by the 2325 Ivans in Bosnia.
        </Text>
        <Text className="text-lg sm:text-xl">
          Along with this, we hope to continue fostering a sense of community
          between Ryans all throughout the world, one meetup at a time.
        </Text>
      </div>
    </div>
  );
};

export { Mission };
