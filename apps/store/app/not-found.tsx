import { NotFoundCard } from "@ryanmeetup/ui";
import { buildPageMetadata, DEFAULT_IMAGE } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Page not found",
  description: "We couldn’t find this page. Head back to the Ryan goods.",
  canonical: "/",
  image: DEFAULT_IMAGE,
});

export default function NotFound() {
  return (
    <main className="store-container grid min-h-[65vh] items-center py-12 sm:py-16 lg:py-20">
      <NotFoundCard
        title={<>Wrong aisle.<br />Right store.</>}
        description="We couldn’t find the page you’re looking for. Let’s get you back to the Ryan goods."
        primaryAction={{ href: "/collections/all", label: "Shop all" }}
        secondaryAction={{ href: "/", label: "Store home" }}
        helpLink={{ href: "/contact", label: "Contact store support" }}
      />
    </main>
  );
}
