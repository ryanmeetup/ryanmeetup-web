// Components
import NextLink from "next/link";
import { Heading, Text } from "@ryanmeetup/ui";

type HistoryProps = {
  hrefStyles: string;
};

const History = (props: HistoryProps) => {
  const { hrefStyles } = props;

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:gap-10 lg:py-10">
      <div className="lg:col-span-4">
        <Heading
          className="text-3xl title sm:text-4xl lg:text-5xl"
          size="h2"
        >
          From a neighborhood poster to a movement.
        </Heading>
      </div>
      <div className="space-y-4 lg:col-span-8">
        <Text className="text-lg sm:text-xl">
          The Ryan Meetup started in February 2023 simply as a means for our
          founder, Ryan, to make new friends in her Brooklyn neighborhood. After
          putting up &apos;IS YOUR NAME RYAN?&apos; posters throughout BedStuy
          and Bushwick, she scheduled the first event, the{" "}
          <NextLink
            className={hrefStyles}
            href="https://www.meetup.com/ryanmeetup/events/291351850/"
          >
            Ryan Kickoff
          </NextLink>
          , where only two other Ryans showed up.
        </Text>
        <Text className="text-lg sm:text-xl">
          After hitting it off at the first meetup, these three Ryans would go
          on to start coordinating the next Ryan Meetup together, the{" "}
          <NextLink
            href="https://photos.app.goo.gl/geVH89W3oHacNfXA9"
            className={hrefStyles}
          >
            Ryan Roundup
          </NextLink>{" "}
          in March 2023. After putting up more posters around NYC, this event
          would end up going viral on Reddit and Instagram and bringing forth
          100 new Ryans for the movement.
        </Text>
      </div>
    </div>
  );
};

export { History };
