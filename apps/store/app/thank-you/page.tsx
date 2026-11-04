import type { Metadata } from "next";
import { Button, Card, Heading, Kicker, Text } from "@ryanmeetup/ui";
import { FiCheck } from "react-icons/fi";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false, follow: false } };

export default function ThankYouPage() {
  return (
    <main className="store-container grid min-h-[65vh] place-items-center py-16">
      <Card size="lg" className="max-w-xl text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-nametag text-2xl text-white"><FiCheck aria-hidden /></span>
        <Kicker className="mt-6">Order confirmed</Kicker>
        <Heading size="h1" className="mt-2 text-4xl sm:text-5xl">You’ve got the goods.</Heading>
        <Text className="mt-4">Shopify will email your receipt and tracking details. Your order is headed to the presses. Ryan commerce proceeds as planned.</Text>
        <div className="mt-8"><Button.Link href="/collections/all" size="md" fullWidth>Keep browsing</Button.Link></div>
      </Card>
    </main>
  );
}
