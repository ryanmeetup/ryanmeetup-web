import Link from "next/link";
import { Card, Heading, Kicker, Text } from "@ryanmeetup/ui";
import { FiHash, FiMail, FiMonitor, FiMousePointer, FiNavigation, FiPackage } from "react-icons/fi";
import { StoreContactForm } from "@/components/store-contact-form";
import { buildPageMetadata, DEFAULT_IMAGE } from "@/lib/metadata";
import { getCustomerAccountUrl } from "@/lib/shopify";
import { getAdminOrdersUrl, parseSupportPrefill, SITE_BUG_TOPIC } from "@/lib/support";

export const metadata = buildPageMetadata({
  title: "Store customer service",
  description: "Contact Ryan Meetup Store customer service about an order, product, or delivery.",
  canonical: "/contact",
  image: DEFAULT_IMAGE,
});

function getHelpfulDetails(hasAccount: boolean) {
  return [
    { icon: FiHash, title: "Order number", text: hasAccount ? "Find it in your order confirmation email or under Your orders." : "Find it in your order confirmation email." },
    { icon: FiMail, title: "Order email", text: "Share the address used when the order was placed." },
    { icon: FiPackage, title: "Product details", text: "Include the item, size, color, and what went sideways." },
  ];
}

// Opened from the bug banner or footer: the intro and clues speak to the site, not an order.
const bugReportDetails = [
  { icon: FiNavigation, title: "Where it happened", text: "The page you were on. We fill it in when you come from the banner." },
  { icon: FiMousePointer, title: "What you did", text: "What you clicked or typed, and what happened instead." },
  { icon: FiMonitor, title: "Your device", text: "We send your browser and window size along, so you can skip that part." },
];

type SearchParam = string | string[];
type Props = { searchParams: Promise<{ order?: SearchParam; email?: SearchParam; topic?: SearchParam; from?: SearchParam }> };

export default async function ContactPage({ searchParams }: Props) {
  const prefill = parseSupportPrefill(await searchParams);
  const isBugReport = prefill.topic === SITE_BUG_TOPIC;
  const helpfulDetails = isBugReport ? bugReportDetails : getHelpfulDetails(Boolean(await getCustomerAccountUrl().catch(() => null)));
  return (
    <main className="store-container py-8 sm:py-12 lg:py-16">
      <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-white/80 p-5 shadow-drop-lg backdrop-blur-[2px] sm:p-8 dark:border-white/10 dark:bg-white/5 lg:p-10">
        <div aria-hidden className="absolute -right-24 -top-24 hidden h-64 w-64 rounded-full bg-nametag/10 blur-3xl lg:block" />
        <div className="relative grid gap-10 xl:grid-cols-[0.75fr_1.25fr] xl:gap-16">
          <div className="space-y-8 xl:py-4">
            <div className="space-y-5">
              <Heading size="h1" className="text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
                {isBugReport ? "Found a bug? Nice catch." : "Let’s sort out your order."}
              </Heading>
              <Text className="text-lg text-black/80 dark:text-white/80">
                {isBugReport
                  ? "The store is new, and you’ve spotted something we missed. Tell us what went sideways, and if we can confirm the bug, we’ll email you a thank-you coupon."
                  : "Questions about a product, shipment, or something that arrived less Ryan-ready than expected? Send the details to the same team behind RyanMeetup.com."}
              </Text>
            </div>

            <Card variant="solid" size="lg" className="space-y-5 bg-white/85 dark:bg-black/40">
              <Kicker>Helpful details</Kicker>
              <div className="grid gap-5">
                {helpfulDetails.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="grid grid-cols-[auto_1fr] gap-3">
                    <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-nametag/10 text-nametag">
                      <Icon aria-hidden />
                    </span>
                    <div>
                      <h2 className="font-cooper text-lg tracking-wide">{title}</h2>
                      <Text className="text-sm">{text}</Text>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Text className="text-sm">
              Shipping times, final sales, or privacy?{" "}
              <Link
                href="/policies"
                className="rounded-sm font-semibold text-black underline decoration-black/30 underline-offset-4 transition hover:decoration-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:text-white dark:decoration-white/30 dark:hover:decoration-white dark:focus-visible:ring-white/40"
              >
                Our store policies
              </Link>{" "}
              may answer it before you hit send.
            </Text>
          </div>

          <Card variant="solid" size="lg" className="bg-white/95 shadow-drop dark:border-white/15 dark:bg-black/80 sm:p-8">
            <Heading size="h2" className="text-2xl sm:text-3xl">Contact customer service</Heading>
            <Text className="mt-2 text-sm sm:text-base">Give us the clearest clues you have. We’ll route everything through the Ryan Meetup contact team.</Text>
            <div className="mt-6 border-t border-black/10 pt-6 dark:border-white/10">
              <StoreContactForm key={prefill.topic} prefill={prefill} adminOrdersUrl={getAdminOrdersUrl()} />
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
