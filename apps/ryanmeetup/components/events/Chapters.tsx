// Components
import NextLink from "next/link";
import NextImage from "next/image";
import { Heading, Text } from "@ryanmeetup/ui";

const Chapters = () => {
  return (
    <NextLink href="/chapters" className="group">
      <div className="border flex flex-col items-center justify-center shadow-xl border-gray-700 rounded-2xl min-h-96 h-full timing hover:border-white hover:scale-102">
        <div className="relative w-full flex items-center justify-center rounded-2xl h-full overflow-hidden bg-center">
          <div className="w-full h-96 md:h-full brightness-30">
            <NextImage
              src={"/group-photos/ryanroundup.png"}
              alt="Check out Ryan Meetup Local Chapters"
              fill
              style={{ objectFit: "cover" }}
            />
          </div>
          <div className="absolute w-full inset-x-0 text-white text-xs text-center leading-4 flex items-center justify-center flex-col px-8">
            <Heading className="text-3xl text-white" size="h2">
              Ryan Meetup Chapters
            </Heading>
            <Text className="text-white text-xl mt-4">
              We&apos;re expanding the Ryan Meetup!
            </Text>
            <Text className="text-white text-xl mt-4">
              Check out our local chapters and join the community in your city.
            </Text>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/10 px-5 py-2 text-xs font-semibold text-white transition group-hover:bg-white group-hover:text-black">
              Explore chapters
            </div>
          </div>
        </div>
      </div>
    </NextLink>
  );
};

export { Chapters };
