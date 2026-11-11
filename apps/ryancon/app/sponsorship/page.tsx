// Components
import { Layout } from "@/components/navigation";
import { Button, Card, Divider, Heading, Text } from "@ryanmeetup/ui";

// Utilities
import { contactHrefs } from "@/utils/contact";

const tiers = [
  {
    name: "Contributing Partner",
    price: "$5K",
    highlights: ["Logo placements", "Onsite signage", "Community exposure"],
    description:
      "Meaningful support with strong brand placement and community reach.",
  },
  {
    name: "Core Partner",
    price: "$10K",
    highlights: ["Booth + activation", "Digital features", "Co-marketing"],
    description:
      "High-impact presence for brands ready to reach the full Ryan audience.",
  },
  {
    name: "Founding Partner",
    price: "$20K+",
    highlights: ["Title placement", "Stage mentions", "Press inclusion"],
    description:
      "Flagship partnership with top-tier brand visibility across the event.",
  },
  {
    name: "Custom",
    price: "Let’s talk!",
    highlights: ["Tailored package", "Unique activations", "Community-first"],
    description: "We’ll build a sponsorship plan around your goals and budget.",
  },
];

const benefits = [
  {
    title: "Brand visibility",
    detail: "Onsite signage, digital placements, and co-marketing moments.",
  },
  {
    title: "Audience reach",
    detail: "A passionate community ready to rally around RyanCon.",
  },
  {
    title: "Activation space",
    detail: "Booths, experiences, and interactive touchpoints.",
  },
  {
    title: "Press + social",
    detail: "Feature in media outreach, posts, and recap coverage.",
  },
  {
    title: "Community goodwill",
    detail: "Support a record-setting community event with heart.",
  },
  {
    title: "Custom collabs",
    detail: "Launch a product or program with the Ryan crowd.",
  },
];

const stats = [
  { value: "2,000+", label: "Ryans expected" },
  { value: "25+", label: "Partner activations" },
  { value: "1M+", label: "Social impressions" },
  { value: "30+", label: "Press mentions" },
];

const sponsorFaqs = [
  {
    q: "When should partners commit?",
    a: "We recommend reserving your tier 3–6 months before the event.",
  },
  {
    q: "Can we customize a package?",
    a: "Absolutely. We build custom activations aligned to your goals.",
  },
  {
    q: "What kind of audience attends?",
    a: "A diverse, engaged community from across the country and beyond.",
  },
  {
    q: "How are sponsors featured?",
    a: "Onsite signage, social content, email campaigns, and stage moments.",
  },
];

const SponsorshipPage = () => {
  return (
    <Layout className="space-y-12">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center">
        <Heading className="text-4xl title sm:text-5xl lg:text-6xl" size="h1">
          Partner with RyanCon.
        </Heading>
        <Text className="text-lg sm:text-xl">
          Sponsorships fund the world‑record attempt and give brands a front‑row
          seat with a community that loves to show up.
        </Text>
        <Button.Link
          href={contactHrefs.sponsorship}
          variant="primary"
          size="lg"
        >
          Request the sponsorship deck
        </Button.Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => (
          <Card key={tier.name} size="md" hover>
            <div className="space-y-4">
              <div>
                <Heading className="text-xl title" size="h3">
                  {tier.name}
                </Heading>
                <Text className="text-3xl font-semibold text-black dark:text-white">
                  {tier.price}
                </Text>
              </div>
              <Text className="text-sm">{tier.description}</Text>
              <div className="flex flex-wrap gap-2">
                {tier.highlights.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-black/60 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/60"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Divider />

      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Heading className="text-3xl title sm:text-4xl" size="h2">
            High‑energy, high‑visibility, high‑community.
          </Heading>
          <Text className="mt-4 text-base sm:text-lg">
            RyanCon combines a record‑breaking goal with a built‑in fanbase and
            a memorable onsite experience. Sponsors get both attention and
            goodwill.
          </Text>
        </div>
        <div className="lg:col-span-7">
          <div className="grid gap-4 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <Card key={benefit.title} size="sm">
                <Heading className="text-lg title" size="h3">
                  {benefit.title}
                </Heading>
                <Text className="mt-2 text-sm">{benefit.detail}</Text>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <Divider />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} size="md">
            <div className="space-y-2">
              <Text className="text-3xl font-semibold text-black dark:text-white">
                {stat.value}
              </Text>
              <Text className="text-xs uppercase tracking-[0.3em] text-black/60 dark:text-white/60">
                {stat.label}
              </Text>
            </div>
          </Card>
        ))}
      </div>

      <Divider />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Heading className="text-3xl title sm:text-4xl" size="h2">
            Sponsorship questions.
          </Heading>
          <Text className="mt-3 text-base sm:text-lg">
            We can tailor a package to fit your goals and budget.
          </Text>
        </div>
        <div className="space-y-4 lg:col-span-8">
          {sponsorFaqs.map((item) => (
            <Card key={item.q} size="md">
              <Heading className="text-lg title" size="h3">
                {item.q}
              </Heading>
              <Text className="mt-2 text-sm">{item.a}</Text>
            </Card>
          ))}
        </div>
      </div>

      <Card size="lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Heading className="text-2xl title" size="h3">
              Ready to partner with RyanCon?
            </Heading>
            <Text className="text-base">
              Let’s build a sponsorship plan that works for your brand.
            </Text>
          </div>
          <Button.Link
            href={contactHrefs.sponsorship}
            variant="primary"
            size="lg"
          >
            Contact sponsorships
          </Button.Link>
        </div>
      </Card>
    </Layout>
  );
};

export default SponsorshipPage;
