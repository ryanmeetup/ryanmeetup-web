// Components
import { Layout } from "@/components/navigation";
import { HeroCard } from "@/components/global";
import { Divider, Text } from "@ryanmeetup/ui";
import { Moments } from "@/components/about";
import { BenefitsSection } from "@/components/home";

// Types
import { buildPageMetadata } from "@/utils/metadata";

export const metadata = buildPageMetadata({
  title: "Ryan Meetup - About",
  description: "Learn how the Ryan Meetup got its start.",
  canonical: "https://ryanmeetup.com/about",
  image: {
    url: "https://ryanmeetup.com/group-photos/ryankickoff.png",
    width: 1600,
    height: 800,
  },
  keywords: [
    "ryan meetup",
    "ryan meetup",
    "who started the ryan meetup",
    "about ryan meetup",
    "ryan meetup story",
    "ryan meetup history",
    "ryan meetup founders",
  ],
});

const AboutPage = () => {
  const story = [
    'In February 2023, Ryan decided she wanted to meet more people named Ryan. So she posted a handful of flyers in her Brooklyn neighborhood with a QR code that implored Ryans to RSVP for a "Ryan Meetup." Only two other Ryans attended.',
    "That night, after checking each other's IDs, Ryan, Ryan, and Ryan devised a plan to reach more Ryans—and set an ambitious goal for themselves: to break the world record for the largest same first name gathering of all time.",
    "So the Ryans got to work, covering NYC in flyers to advertise their next event at Ryan Maguire's pub—but this time, over 100 Ryans showed up, including some Ryans from major news sources, who helped spread the word to even more Ryans.",
    "Soon, Ryans everywhere wanted to join in on the fun. So we took Ryan Meetup on tour, hosting events in Los Angeles, Denver, Chicago, and more. All while building a community with thousands of Ryans, who each contribute in their own unique way. And that's exactly what it will take to put our name in the record books.",
    "When your name is called, be ready Ryan. We're going to need you.",
  ];

  return (
    <Layout>
      <div className="xl:px-20 space-y-12">
        <HeroCard
          title="About Ryan Meetup"
          description="A community built by Ryans, for Ryans, with a mission to unite the most Ryans in one place and make history together."
          badges={["Founded 2023", "Brooklyn, NY", "Not-for-profit"]}
          image={{
            src: "/group-photos/ryankickoff.png",
            alt: "The first Ryan Meetup",
            eyebrow: "First meetup",
            title: "Ryan Kickoff 2023",
          }}
        />

        <section className="space-y-6">
          {story.map((paragraph, index) => (
            <Text
              key={index}
              className="text-lg text-black/70 dark:text-white/70"
            >
              {paragraph}
            </Text>
          ))}
        </section>

        <Divider />

        <BenefitsSection />

        <Divider />

        <Moments />
      </div>
    </Layout>
  );
};

export default AboutPage;
