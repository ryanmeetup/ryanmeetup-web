// Components
import { Layout } from "@/components/navigation";
import {
  Button,
  Card,
  Divider,
  Heading,
  IconBadge,
  Text,
} from "@ryanmeetup/ui";
import {
  FaHandsHelping as Help,
  FaDollarSign as Dollar,
  FaCamera as Camera,
  FaPenNib as Pen,
  FaLaptopCode as Code,
  FaBullhorn as Bullhorn,
  FaGlobe as Globe,
} from "react-icons/fa";
import { FaGear as Gear } from "react-icons/fa6";
import { RiFilePaper2Line as Flyer } from "react-icons/ri";
import { IoPersonAdd as Socials } from "react-icons/io5";
import {
  MdMovie as Video,
  MdDesignServices as Design,
  MdBusinessCenter as Business,
} from "react-icons/md";

// Types
import { buildPageMetadata } from "@/utils/metadata";
import { contactHrefs } from "@/utils/contact";

export const metadata = buildPageMetadata({
  title: "Ryan Meetup - Contribute",
  description: "Learn how you can contribute to the Ryan Meetup.",
  canonical: "https://ryanmeetup.com/contribute",
  image: {
    url: "https://ryanmeetup.com/group-photos/ryankickoff.png",
    width: 1600,
    height: 800,
  },
  keywords: [
    "donate to the ryan meetup",
    "ryan meetup venmo",
    "ryan meetup zelle",
    "ryan meetup money",
    "contribute to ryan meetup",
    "ryan meetup volunteer",
    "ryan meetup team",
    "ryan meetup contributions",
  ],
});

const ContributePage = async () => {
  const waysToSupport = [
    {
      title: "Invite more Ryans",
      body: "The goal is gathering as many Ryans as possible, and this is the easiest way to expand our network.",
      icon: <Socials className="h-5 w-5" />,
    },
    {
      title: "Hang up flyers",
      body: "This is how it all started for us, and it's an effective way to reach Ryans in the wild.",
      icon: <Flyer className="h-5 w-5" />,
    },
    {
      title: "Share your skills",
      body: "Combining our capabilities makes the Ryan Meetup stronger and more self-sustaining.",
      icon: <Help className="h-5 w-5" />,
    },
    {
      title: "Support the mission",
      body: "Merch purchases and donations help fund future events and community growth.",
      icon: <Dollar className="h-5 w-5" />,
    },
  ];

  const composed = [
    {
      title: "Photo / Video",
      icon: <Camera className="h-5 w-5" />,
    },
    {
      title: "Creative Director",
      icon: <Pen className="h-5 w-5" />,
    },
    {
      title: "Engineering",
      icon: <Code className="h-5 w-5" />,
    },
    {
      title: "Production / Writing",
      icon: <Video className="h-5 w-5" />,
    },
    {
      title: "Marketing / Outreach",
      icon: <Bullhorn className="h-5 w-5" />,
    },
    {
      title: "Graphic Design",
      icon: <Design className="h-5 w-5" />,
    },
    {
      title: "Social Media",
      icon: <Globe className="h-5 w-5" />,
    },
    {
      title: "Logistics",
      icon: <Gear className="h-5 w-5" />,
    },
    {
      title: "Business Development",
      icon: <Business className="h-5 w-5" />,
    },
  ];

  return (
    <Layout>
      <section className="space-y-4 text-center mb-8">
        <Heading className="text-4xl title sm:text-5xl lg:text-6xl" size="h1">
          Contribute to the Ryan Meetup
        </Heading>
        <Text className="text-lg text-black/70 dark:text-white/70">
          We have an army of Ryans at our disposal. The more Ryans who pitch in,
          the faster we&apos;ll grow.
        </Text>
        <Text className="text-lg text-black/70 dark:text-white/70">
          Our entire team is 100% volunteer-based.
        </Text>
      </section>

      <Card
        variant="soft"
        size="lg"
        className="shadow-drop lg:p-10"
      >
        <div className="space-y-4">
          <Heading className="text-3xl title sm:text-4xl" size="h2">
            Team & Skills
          </Heading>
          <Text className="text-base text-black/70 dark:text-white/70">
            These cards represent the Ryans currently on the team. If you have a
            relevant skill, we&apos;d love for you to join our volunteer crew.
          </Text>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {composed.map((role) => (
            <Card key={role.title} variant="solid" size="md" hover>
              <div className="flex items-center gap-3">
                <IconBadge>{role.icon}</IconBadge>
                <Text className="text-sm uppercase tracking-caps-wide text-black/70 dark:text-white/70">
                  {role.title} Ryan
                </Text>
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-6">
          <Button.Link
            href={contactHrefs.joinTeam}
            leftIcon={<Socials className="h-4 w-4" />}
            variant="primary"
            size="md"
            fullWidth
            newTab={false}
          >
            Join the team
          </Button.Link>
        </div>
      </Card>

      <Divider margins="xl" />

      <Card
        variant="soft"
        size="lg"
        className="shadow-drop lg:p-10"
      >
        <div className="space-y-6">
          <Heading className="text-3xl title sm:text-4xl" size="h2">
            Ways to Contribute
          </Heading>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {waysToSupport.map((item) => (
              <Card key={item.title} variant="solid" size="md" hover>
                <div className="flex items-center gap-3">
                  <IconBadge>{item.icon}</IconBadge>
                  <Text className="text-sm uppercase tracking-caps-wide text-black/70 dark:text-white/70">
                    {item.title}
                  </Text>
                </div>
                <Text className="mt-3 text-sm text-black/70 dark:text-white/70">
                  {item.body}
                </Text>
              </Card>
            ))}
          </div>
        </div>
      </Card>
    </Layout>
  );
};

export default ContributePage;
