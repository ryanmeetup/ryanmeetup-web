import type { Metadata } from "next";
import { Card, Heading, Kicker, Pill, Text } from "@ryanmeetup/ui";
import { FiHash, FiMail, FiPackage } from "react-icons/fi";
import { StoreContactForm } from "@/components/store-contact-form";

export const metadata: Metadata = {
  title: "Store customer service",
  description: "Contact Ryan General Store customer service about an order, product, or delivery.",
};

const helpfulDetails = [
  { icon: FiHash, title: "Order number", text: "Find it in your order confirmation email." },
  { icon: FiMail, title: "Order email", text: "Share the address used when the order was placed." },
  { icon: FiPackage, title: "Product details", text: "Include the item, size, color, and what went sideways." },
];

export default function ContactPage() {
  return (
    <main className="store-container py-8 sm:py-12 lg:py-16">
      <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-white/80 p-5 shadow-[0_35px_70px_-50px_rgba(0,0,0,0.6)] backdrop-blur-[2px] sm:p-8 dark:border-white/10 dark:bg-white/5 lg:p-10">
        <div aria-hidden className="absolute -right-24 -top-24 hidden h-64 w-64 rounded-full bg-nametag/10 blur-3xl lg:block" />
        <div className="relative grid gap-10 xl:grid-cols-[0.75fr_1.25fr] xl:gap-16">
          <div className="space-y-8 xl:py-4">
            <div className="space-y-5">
              <Pill>Store support</Pill>
              <Heading size="h1" className="text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
                Let’s sort out your order.
              </Heading>
              <Text className="text-lg text-black/80 dark:text-white/80">
                Questions about a product, shipment, or something that arrived less Ryan-ready than expected? Send the details to the same team behind RyanMeetup.com.
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
          </div>

          <Card variant="solid" size="lg" className="bg-white/95 shadow-[0_25px_50px_-40px_rgba(0,0,0,0.6)] dark:border-white/15 dark:bg-black/80 sm:p-8">
            <Heading size="h2" className="text-2xl sm:text-3xl">Contact customer service</Heading>
            <Text className="mt-2 text-sm sm:text-base">Give us the clearest clues you have. We’ll route everything through the Ryan Meetup contact team.</Text>
            <div className="mt-6 border-t border-black/10 pt-6 dark:border-white/10">
              <StoreContactForm />
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
