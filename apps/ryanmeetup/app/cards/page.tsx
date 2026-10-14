// Components
import { Layout } from "@/components/navigation";
import NextImage from "next/image";
import { Backdrop } from "@/components/global";
import { Button, Card, Heading, IconBadge, Pill, Text } from "@ryanmeetup/ui";
import { HiOutlineMail as Envelope } from "react-icons/hi";
import { FiCheck as Check } from "react-icons/fi";
import { CardInfo } from "@/components/cards";
import { layoutPaddingX } from "@/lib/constants";

// Types
import { buildPageMetadata } from "@/utils/metadata";
import { contactHrefs } from "@/utils/contact";

export const metadata = buildPageMetadata({
  title: "Buy Membership Card",
  description:
    "You've always been a member, and now you have the card to prove it.",
  canonical: "https://ryanmeetup.com/cards",
  image: {
    url: "https://ryanmeetup.com/meta/cards.png",
    width: 4032,
    height: 3024,
  },
  keywords: [
    "ryan meetup membership card",
    "ryan meetup card",
    "ryan meetup merch card",
    "ryan meetup membership",
  ],
});

const orderHelpTopics = [
  "Order status and tracking",
  "Shipping or address changes",
  "Damaged cards, refunds, or exchanges",
  "Bulk or group orders",
];

const BuyCardsPage = () => {
  return (
    <Layout fullscreen>
      <Backdrop imageSrc="/backdrop.png">
        <section
          className={`grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center py-8 ${layoutPaddingX}`}
        >
          <div className="space-y-6">
            <Pill>Membership</Pill>
            <Heading
              className="text-4xl title sm:text-5xl lg:text-6xl"
              size="h1"
            >
              The Ryan Meetup Membership Card
            </Heading>
            <Text className="text-lg text-black/70 dark:text-white/80">
              You’ve always been a member — now you can prove it.
            </Text>

            <div className="relative h-[360px] w-full sm:h-[480px]">
              <NextImage
                src="/cards.png"
                alt="Ryan Meetup Membership Card"
                className="object-contain"
                fill
                sizes="(max-width: 1023px) 100vw, 50vw"
              />
            </div>

            <Card
              variant="outline"
              size="sm"
              className="border-black/10 bg-white/80 text-black/70 dark:border-white/20 dark:bg-white/10 dark:text-white/80"
            >
              Shown: front / back of the membership card.
            </Card>
          </div>

          <div className="space-y-6">
            <CardInfo />
          </div>
        </section>
      </Backdrop>

      <section className={`py-12 ${layoutPaddingX}`}>
        <Card
          variant="soft"
          size="lg"
          className="mx-auto flex max-w-3xl items-start gap-4 sm:gap-6"
        >
          <IconBadge size="lg">
            <Envelope className="h-5 w-5" aria-hidden />
          </IconBadge>
          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-1">
              <Heading className="text-2xl title" size="h2">
                Questions about your RY-D?
              </Heading>
              <Text className="text-black/70 dark:text-white/70">
                Ryan at P&amp;M Apparel makes and ships every card. Reach out
                about:
              </Text>
            </div>
            <ul className="grid gap-2 text-sm text-black/80 dark:text-white/80 sm:grid-cols-2">
              {orderHelpTopics.map((topic) => (
                <li key={topic} className="flex items-start gap-2">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-black/50 dark:text-white/50"
                    aria-hidden
                  />
                  {topic}
                </li>
              ))}
            </ul>
            <Text className="text-sm text-black/70 dark:text-white/70">
              Have your order number handy if you&apos;ve already ordered.
            </Text>
            <Button.Link
              href={contactHrefs.cardsSupport}
              newTab={false}
              leftIcon={<Envelope aria-hidden />}
              variant="primary"
              size="md"
              fullWidth
            >
              Email P&amp;M
            </Button.Link>
          </div>
        </Card>
      </section>
    </Layout>
  );
};

export default BuyCardsPage;
