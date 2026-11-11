// Components
import { Layout } from "@/components/navigation";
import { Blurb, Button, Divider } from "@ryanmeetup/ui";
import { FeaturedIn, PressFeed } from "@/components/press";
import { layoutPaddingX } from "@/lib/constants";
import {
  FaBookOpen as LearnMore,
  FaEnvelope as Email,
} from "react-icons/fa6";

// Types
import type { Article as RyanArticle, Outlet } from "@/lib/types";
import { buildPageMetadata } from "@/utils/metadata";
import { contactHrefs } from "@/utils/contact";

// Utilities
import { fetchArticles, fetchOutlets } from "@/actions/fetchContent";

export const metadata = buildPageMetadata({
  title: "Ryan Meetup - Press",
  description: "Read all about the Ryan Meetup in the news.",
  canonical: "https://ryanmeetup.com/press",
  image: {
    url: "https://ryanmeetup.com/meta/press.jpg",
    width: 2188,
    height: 1458,
  },
  keywords: [
    "ryans only",
    "ryans only at the ryan meetup",
    "and definitely no bryans",
    "nyc irish bar plays host to viral ryan meetup",
    "ryan meetup in the news",
    "ryan meetup news",
    "ryan meetup articles",
    "ryan meetup press",
    "first rule of ryan club, no bryans",
    "no bryans allowed",
    "ryan maguire",
    "hosts bash for people named ryan",
    "to get into this party",
    "need the right name",
    "its ryan",
    "alyson krueger",
    "will pavia",
    "kerry oshea",
    "ryan wilde",
    "ryan andrew wilde",
    "the takeaway",
    "the times",
    "irish central",
    "the times",
    "downtown new york alliance",
    "new york times",
    "miami new times",
    "houston chronicle",
    "los angeles times",
    "ryan meetup press kit",
    "ryan meetup media coverage",
    "ryan meetup news coverage",
  ],
});

const PressPage = async () => {
  const articles = await fetchArticles();
  const outlets = await fetchOutlets();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: (articles as unknown as RyanArticle[]).map(
      (article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "NewsArticle",
          headline: article.title,
          datePublished: new Date(article.publishDate).toISOString(),
          author: {
            "@type": "Person",
            name: article.author,
          },
          publisher: {
            "@type": "Organization",
            name: article.outlet,
          },
          mainEntityOfPage: article.href,
          url: article.href,
        },
      }),
    ),
  };

  return (
    <Layout fullscreen>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className={`pt-8 ${layoutPaddingX}`}>
        <Blurb
          fullHeadline="RYAN MEETUP"
          smallHeadline="RYAN MEETUP"
        >
          <p className="mb-6 text-center text-lg italic text-black/70 dark:text-white/70">
            has been proudly featured in:
          </p>
        </Blurb>
      </div>

      <FeaturedIn outlets={outlets as Outlet[]} />

      <div className={`pb-20 ${layoutPaddingX}`}>
        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <Button.Link
            href="/about"
            newTab={false}
            variant="secondary"
            size="md"
            leftIcon={<LearnMore className="h-4 w-4" />}
            fullWidth
            className="sm:min-w-[220px]"
          >
            Learn More
          </Button.Link>
          <Button.Link
            href={contactHrefs.press}
            newTab={false}
            variant="primary"
            size="md"
            leftIcon={<Email className="h-4 w-4" />}
            fullWidth
            className="sm:min-w-[220px]"
          >
            Get In Touch
          </Button.Link>
        </div>

        <Divider />

        <PressFeed articles={articles as unknown as RyanArticle[]} />
      </div>
    </Layout>
  );
};

export default PressPage;
