// Components
import { Layout } from "@/components/navigation";
import { Blurb, Divider, Text } from "@ryanmeetup/ui";
import { FAQ } from "@/components/home";
import { ChapterDirectory } from "@/components/chapters";

// Types
import type {
  FrequentlyAskedQuestion,
  RyanChapter,
  RyanEvent,
} from "@/lib/types";
import { buildPageMetadata } from "@/utils/metadata";

// Utilities
import { fetchChapters, fetchFAQs, fetchEvents } from "@/actions/fetchContent";
import { getChaptersFixture } from "@/lib/test-fixtures/chapters";
import { isEventUpcoming } from "@/utils/date";

export const metadata = buildPageMetadata({
  title: "Ryan Meetup - Chapters",
  description:
    "Introducing Ryan Meetup chapters - a new way to keep connected with your local Ryans, and continue building that sense of community even closer to home.",
  canonical: "https://ryanmeetup.com/chapters",
  image: {
    url: "https://ryanmeetup.com/meta/chapters.jpg",
    width: 2188,
    height: 1458,
  },
  keywords: [
    "ryan meetup chapters",
    "local ryan meetup",
    "ryan meetup near me",
    "where is the next ryan meetup",
    "start your own ryan meetup",
    "ryan meetup event",
    "host a ryan meetup",
    "ryan meetup chapters list",
    "ryan meetup chapter near me",
    "ryan meetup local chapters",
  ],
});

const ChaptersPage = async ({
  searchParams,
}: {
  searchParams?: Promise<{ fixture?: string }>;
}) => {
  const resolvedSearchParams = await searchParams;
  const fixture =
    process.env.E2E_TESTS === "true"
      ? getChaptersFixture(resolvedSearchParams?.fixture)
      : null;

  const faqs = fixture?.faqs ?? (await fetchFAQs());
  const chapters = fixture?.chapters ?? (await fetchChapters());
  const events = (fixture?.events ?? (await fetchEvents())) as RyanEvent[];

  const chapterEvents = events.filter((event) => {
    if (event.chapter?.includes("Main")) {
      return false;
    }

    return isEventUpcoming(event.date);
  });

  const chapterFaqs = faqs
    .filter((faq) => faq.type === "chapter")
    .sort((a, b) => Number(a.loadOrder) - Number(b.loadOrder));

  const activeChapters = chapters.filter((chapter) => chapter.active);

  const upcomingEvents = new Set(
    chapterEvents
      .flatMap((event) => event.chapter ?? [])
      .filter((chapterName) => chapterName && chapterName !== "Main"),
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        name: "Ryan Meetup Chapters",
        itemListElement: (activeChapters as RyanChapter[]).map(
          (chapter, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: {
              "@type": "Organization",
              name: `${chapter.city} Ryan Meetup Chapter`,
              url: `https://ryanmeetup.com/chapters/${chapter.slug}`,
            },
          }),
        ),
      },
      {
        "@type": "FAQPage",
        mainEntity: (chapterFaqs as FrequentlyAskedQuestion[]).map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  };

  return (
    <Layout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="space-y-6">
        <Blurb
          fullHeadline="Ryan Meetup Chapters"
          smallHeadline="Ryan Meetup Chapters"
        >
          <Text className="secondary text-xl mb-6 xl:mx-40">
            Introducing Ryan Meetup chapters — a new way to keep connected with
            your local Ryans, and continue building that sense of community even
            closer to home.
          </Text>
        </Blurb>

        <ChapterDirectory
          chapters={activeChapters as RyanChapter[]}
          upcomingCities={Array.from(upcomingEvents)}
        />
      </div>

      <Divider margins="lg" />

      <FAQ showTitle data={chapterFaqs as FrequentlyAskedQuestion[]} />
    </Layout>
  );
};

export default ChaptersPage;
