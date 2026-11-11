// Components
import { Layout } from "@/components/navigation";
import { Button, Heading, Text } from "@ryanmeetup/ui";
import { FAQ } from "@/components/faqs";
import { FaRegNewspaper as Newsletter } from "react-icons/fa6";

// Utilities
import { fetchFAQs } from "@/actions/fetchContent";

const FAQsPage = async () => {
  const faqs = await fetchFAQs();

  return (
    <Layout>
      <section className="space-y-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center">
          <Heading className="text-4xl title sm:text-5xl lg:text-6xl" size="h1">
            Questions from the Ryan community.
          </Heading>
          <Text className="text-lg sm:text-xl">
            Everything you need to know about RyanCon, the Ryan Meetup, and how
            to get involved.
          </Text>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/5 space-y-4">
              <Heading className="text-2xl title sm:text-3xl" size="h2">
                We&apos;re here for you.
              </Heading>
              <Text className="text-base">
                Can&apos;t find what you need? Reach out and we&apos;ll respond
                as soon as possible.
              </Text>

              <Button.Link
                href="https://ryanmeetup.com/newsletter"
                leftIcon={<Newsletter className="w-5 h-5" />}
                fullWidth
                variant="primary"
                size="lg"
              >
                Sign up for our newsletter
              </Button.Link>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="space-y-4">
              {faqs.map((faq) => (
                <FAQ
                  key={faq.question as string}
                  question={faq.question as string}
                  answer={faq.answer as string}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default FAQsPage;
