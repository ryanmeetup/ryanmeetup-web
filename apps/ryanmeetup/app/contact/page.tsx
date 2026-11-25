import { Suspense } from "react";

// Components
import { Layout } from "@/components/navigation";
import { Card, Heading, NameTagSticker, Text } from "@ryanmeetup/ui";
import { ContactForm, FollowUs } from "@/components/contact";

// Utilities
import { contactTopics, DEFAULT_INBOX } from "@/utils/contact";
import { buildPageMetadata } from "@/utils/metadata";

type ContactSearchParams = {
  topic?: string | string[];
  detail?: string | string[];
  source?: string | string[];
  subject?: string | string[];
  message?: string | string[];
};

type ContactPageProps = {
  searchParams?: Promise<ContactSearchParams>;
};

const firstValue = (value?: string | string[]) =>
  typeof value === "string" ? value : "";

export const metadata = buildPageMetadata({
  title: "Ryan Meetup - Contact Us",
  description: "Get in contact with one of the Ryans here.",
  canonical: "https://ryanmeetup.com/contact",
  image: {
    url: "https://ryanmeetup.com/group-photos/ryankickoff.png",
    width: 1600,
    height: 800,
  },
  keywords: [
    "contact ryan",
    "contact ryan meetup",
    "ryan meetup email address",
    "official ryan business",
    "big and important ryan topics",
    "ryan",
    "ryan meetup",
    "ryan meetup contact",
    "ryan meetup email",
    "ryan meetup message",
  ],
});

const ContactPage = async ({ searchParams }: ContactPageProps) => {
  const resolvedSearchParams = await searchParams;

  return (
    <Layout className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-white/80 p-6 shadow-drop-lg dark:border-white/10 dark:bg-white/5 lg:p-10">
        <div className="absolute -right-24 -top-24 hidden h-64 w-64 rounded-full border border-black/10 bg-white/70 blur-3xl dark:border-white/10 dark:bg-white/10 lg:block" />
        <div className="absolute -bottom-24 left-10 hidden h-64 w-64 rounded-full border border-black/10 bg-white/60 blur-3xl dark:border-white/10 dark:bg-white/10 lg:block" />
        <div className="relative grid gap-10 xl:grid-cols-[1.05fr_0.95fr] xl:items-center xl:gap-16">
          <div className="space-y-10">
            <div className="space-y-6">
              <Heading
                className="text-4xl title sm:text-5xl lg:text-6xl"
                size="h1"
              >
                Contact the Ryans
              </Heading>
              <Text className="text-lg text-black/80 dark:text-white/80">
                Pick what you&apos;re writing about and we&apos;ll get your
                note to the right Ryan &mdash; events, local chapters, press,
                partnerships, or any other official Ryan business.
              </Text>
            </div>

            <FollowUs />
          </div>

          <Card
            variant="solid"
            size="lg"
            className="bg-white/95 shadow-drop dark:border-white/15 dark:bg-black/80 xl:bg-gradient-to-br xl:from-white/95 xl:to-white/75 xl:p-8 xl:shadow-drop-lg dark:xl:from-white/10 dark:xl:to-white/[0.03]"
          >
            <NameTagSticker sizes="(min-width: 1280px) 96px, 80px" className="mb-5 ml-1 w-20 xl:w-24" />
            <Heading className="text-2xl title xl:text-3xl" size="h2">
              Send a message
            </Heading>
            <Text className="mt-2 max-w-xl text-sm text-black/70 dark:text-white/70 xl:text-base">
              Tell us why you&apos;re reaching out and we read every note, even
              if a Ryan takes a moment to reply.
            </Text>
            <div className="mt-6 xl:border-t xl:border-black/10 xl:pt-6 dark:xl:border-white/10">
              <Suspense fallback={null}>
                <ContactForm
                  topics={contactTopics}
                  defaultRouteTo={DEFAULT_INBOX}
                  initialTopic={firstValue(resolvedSearchParams?.topic)}
                  initialDetail={firstValue(resolvedSearchParams?.detail)}
                  source={firstValue(resolvedSearchParams?.source)}
                  initialSubject={firstValue(resolvedSearchParams?.subject)}
                  initialMessage={firstValue(resolvedSearchParams?.message)}
                />
              </Suspense>
            </div>
          </Card>
        </div>
      </section>
    </Layout>
  );
};

export default ContactPage;
