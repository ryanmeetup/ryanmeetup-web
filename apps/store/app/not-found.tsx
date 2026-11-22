import { NotFoundCard } from "@ryanmeetup/ui";
import type { Metadata } from "next";

// No canonical or og:url: a missing page has no address of its own, and pointing
// either at the home page reads as a soft 404. Next.js adds noindex itself.
export const metadata: Metadata = {
  title: "Page not found",
  description: "We couldn’t find this page. Head back to the Ryan goods.",
};

export default function NotFound() {
  return (
    <main className="store-container grid min-h-[65vh] items-center py-12 sm:py-16 lg:py-20">
      <NotFoundCard
        title={<>Wrong aisle.<br />Right store.</>}
        description="We couldn’t find the page you’re looking for. Let’s get you back to the Ryan goods."
        primaryAction={{ href: "/collections/all", label: "Shop All" }}
        secondaryAction={{ href: "/", label: "Store home" }}
        helpLink={{ href: "/contact", label: "Contact store support" }}
      />
    </main>
  );
}
