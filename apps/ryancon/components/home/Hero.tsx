// Components
import { Button, Card, Heading, Text } from "@ryanmeetup/ui";
import { FaArrowRight as ArrowRight } from "react-icons/fa6";

const Hero = () => {
  return (
    <section
      className="relative w-full flex overflow-hidden bg-center border-b border-gray-700"
      style={{ height: "calc(100vh - 80px)" }}
    >
      <div className="w-full h-full brightness-30 flex items-center justify-center text-3xl pb-32">
        A VIDEO IS GOING TO GO HERE
      </div>

      <div className="absolute w-full h-full flex items-end p-4 xl:p-20">
        <div className="w-full">
          <div className="grid grid-cols-12">
            <div className="col-span-12 xl:col-span-6 space-y-4">
              <Heading className="text-display2" size="h1">
                RyanCon: the largest same name{" "}
                <span className="underline decoration-blue-500 underline-offset-8">
                  gathering of all time.
                </span>
              </Heading>

              <Text className="text-display3">
                A world record breaking event organized by Ryans, for Ryans.
                Brought to you by the Ryan Meetup.
              </Text>
            </div>

            <div className="lg:col-span-6" />
          </div>

          <div className="mt-8 grid grid-cols-2 items-end lg:mt-20">
            {/* Location, Date, Venue */}
            <Card className="inline-flex flex-col">
              <Text className="text-xs font-semibold uppercase tracking-caps-wide text-black/60 dark:text-white/60">
                Event details
              </Text>
              <div className="mt-3 flex flex-wrap space-x-16">
                <Text className="text-display4">🏙 LOCATION TBD</Text>
                <Text className="text-display4">🗓 DATE TBD</Text>
                <Text className="text-display4">📍 VENUE TBD</Text>
              </div>
            </Card>

            {/* CTA Button */}
            <div className="flex gap-20 justify-end items-center col-span-2 mt-8 lg:col-span-1 lg:mt-0">
              <Button.Link
                className="border bg-white !text-black w-full font-semibold p-4 tracking-wide flex justify-center items-center timing hover:scale-105 lg:w-auto"
                href="/register"
                size="md"
                rightIcon={<ArrowRight className="fill-black ml-4" />}
              >
                GET TICKETS
              </Button.Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Hero };
