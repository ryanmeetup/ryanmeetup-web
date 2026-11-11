// Components
import { Layout } from "@/components/navigation";
import { Card, Heading, Text } from "@ryanmeetup/ui";
import { MediaTile } from "@/components/gallery";
import { FaQuestionCircle as Question } from "react-icons/fa";
import NextLink from "next/link";

// Types
import type { MediaEvent } from "@/lib/types";
import { buildPageMetadata } from "@/utils/metadata";

// Utilities
import { fetchMedia } from "@/actions/fetchContent";
import { sortByEventDateLabel } from "@/utils/date";

export const metadata = buildPageMetadata({
  title: "Ryan Meetup - Gallery",
  description: "View photos from previous Ryan Meetups.",
  canonical: "https://ryanmeetup.com/gallery",
  image: {
    url: "https://ryanmeetup.com/group-photos/rytober.webp",
    width: 1000,
    height: 667,
  },
  keywords: [
    "ryan meetup",
    "ryan meetup gallery",
    "ryan meetup photos",
    "ryan meetup media",
    "pictures of ryan meetup",
    "ryan photos",
    "ryans",
    "ryan meetup photo gallery",
    "ryan meetup event photos",
  ],
});

const GalleryPage = async () => {
  const media = await fetchMedia();

  const tiles = sortByEventDateLabel(
    media.map((item) => item.fields),
    "desc",
  );

  return (
    <Layout>
      <section className="space-y-4 text-center">
        <Heading className="text-4xl title sm:text-5xl lg:text-6xl" size="h1">
          Photo Gallery
        </Heading>
        <Text className="text-lg text-black/70 dark:text-white/70">
          A living archive of Ryan Meetup memories across cities, chapters, and
          unforgettable events.
        </Text>
      </section>

      <Card variant="soft" size="sm" className="mt-10">
        <div className="flex items-start gap-4">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/80 dark:border-white/15 dark:bg-white/10">
            <Question className="h-5 w-5 fill-yellow-500" />
          </div>
          <div>
            <Text className="text-base font-semibold text-black dark:text-white">
              Who is photographing all of these Ryan Meetups?
            </Text>
            <Text className="mt-1 text-sm text-black/70 dark:text-white/70">
              Ryan Rose is the official photographer for the Ryan Meetup. You
              can book a gig with her{" "}
              <NextLink
                className="font-semibold text-blue-700 dark:text-blue-500 underline"
                href="mailto:justryanrose@gmail.com"
              >
                here
              </NextLink>
              .
            </Text>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 mt-10 md:grid-cols-2 xl:grid-cols-3">
        {tiles?.map((content, index) => (
          <MediaTile
            key={`${content.title}-${index}`}
            id={content.title as string}
            data={content as unknown as MediaEvent}
          />
        ))}
      </div>
    </Layout>
  );
};

export default GalleryPage;
