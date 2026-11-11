// Components
import { Layout } from "@/components/navigation";
import { Divider, Heading, Text } from "@ryanmeetup/ui";
import { History, KeepInTouch, MasonryGrid, Mission } from "@/components/about";
import NextImage from "next/image";

// Utilities
import { layoutPaddingX } from "@/lib/constants";

const AboutPage = () => {
  const hrefStyles =
    "font-semibold text-black/80 underline decoration-black/30 underline-offset-4 hover:decoration-black/60 dark:text-white/80 dark:decoration-white/30 dark:hover:decoration-white/60";

  return (
    <Layout fullscreen>
      {/* Banner */}
      <section className="relative flex min-h-[70vh] w-full items-center justify-center overflow-hidden border-b border-black/10 dark:border-white/10">
        <div className="absolute inset-0">
          <NextImage
            src="/ryanroundup.png"
            alt="Ryan Roundup"
            fill
            style={{ objectFit: "cover" }}
            className="brightness-30"
          />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.35),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_60%)]" />
        <div
          className={`relative mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-6 py-20 text-center ${layoutPaddingX}`}
        >
          <Heading
            className="text-4xl sm:text-5xl lg:text-6xl title lg:whitespace-nowrap"
            size="h1"
          >
            Welcome to the Ryan Meetup.
          </Heading>

          <Text className="max-w-3xl text-lg sm:text-xl text-white/90">
            A non-profit organization dedicated to one goal: gathering as many
            Ryans as possible.
          </Text>
        </div>
      </section>

      <section className={`py-10 sm:py-16 ${layoutPaddingX}`}>
        <History hrefStyles={hrefStyles} />

        <div className="mt-10 lg:mt-12">
          <MasonryGrid />
        </div>

        <Divider className="mt-12" />

        <Mission hrefStyles={hrefStyles} />

        <Divider className="mt-12" />

        <KeepInTouch />
      </section>
    </Layout>
  );
};

export default AboutPage;
