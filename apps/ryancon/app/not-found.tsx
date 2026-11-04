import type { Metadata } from "next";
import { NotFoundCard } from "@ryanmeetup/ui";
import { Layout } from "@/components/navigation";

export const metadata: Metadata = {
  title: "Page not found | RyanCon",
  description: "We couldn’t find this page. Find your way back to RyanCon.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    // Keep the construction ribbon inside the header, clear of the recovery links.
    <Layout headerClassName="overflow-hidden">
      <div className="grid min-h-[65vh] items-center py-4 sm:py-8 lg:py-12">
        <NotFoundCard
          title={<>Wrong room.<br />Right crowd.</>}
          description="We couldn’t find this page. The RyanCon details are right this way."
          primaryAction={{ href: "/about", label: "Explore RyanCon" }}
          secondaryAction={{ href: "/", label: "RyanCon home" }}
          helpLink={{ href: "/contact", label: "Contact the RyanCon team" }}
        />
      </div>
    </Layout>
  );
}
