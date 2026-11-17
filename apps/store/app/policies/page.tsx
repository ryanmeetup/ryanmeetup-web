import Link from "next/link";
import { Breadcrumbs, Card, EmptyState, Heading, Text } from "@ryanmeetup/ui";
import { FiArrowRight, FiBookOpen, FiCalendar } from "react-icons/fi";
import { buildPageMetadata, DEFAULT_IMAGE, htmlToText, toMetaDescription } from "@/lib/metadata";
import { StoreHomeIcon } from "@/lib/navigation";
import { splitPolicyLastUpdated, toIsoDate } from "@/lib/policies";
import { getPolicies } from "@/lib/shopify";

export const metadata = buildPageMetadata({
  title: "Store policies",
  description: "Shipping, returns, privacy, and the rest of the Ryan Meetup Store fine print in one place.",
  canonical: "/policies",
  image: DEFAULT_IMAGE,
});

// One card per policy written in Shopify Admin → Settings → Policies, in the
// same order as the footer. A policy left blank there never gets a card.
export default async function PoliciesPage() {
  const policies = await getPolicies();
  return (
    <main className="store-container py-10 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <Breadcrumbs
          variant="compact"
          crumbs={[
            { href: "/", title: "Store", icon: <StoreHomeIcon aria-hidden className="shrink-0" /> },
            { href: "/policies", title: "Policies", current: true, icon: <FiBookOpen aria-hidden className="shrink-0" /> },
          ]}
        />
        <Heading size="h1" className="mt-3 text-4xl leading-[1.05] sm:text-5xl">Store policies</Heading>

        {policies.length ? (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {policies.map((policy) => {
              const { lastUpdated, body } = splitPolicyLastUpdated(policy.body);
              return (
                <li key={policy.handle}>
                  <Card size="none" hover className="h-full">
                    <Link
                      href={`/policies/${policy.handle}`}
                      className="group flex h-full flex-col gap-3 rounded-2xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/40 sm:p-6 dark:focus-visible:ring-white/40"
                    >
                      {/* The date Shopify's copy opens with, pulled out as the card's header row. */}
                      {lastUpdated && (
                        <p className="flex items-center gap-2 border-b border-black/10 pb-3 text-xs font-semibold uppercase tracking-caps text-black/70 dark:border-white/10 dark:text-white/70">
                          <FiCalendar aria-hidden className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            Updated <time dateTime={toIsoDate(lastUpdated)}>{lastUpdated}</time>
                          </span>
                        </p>
                      )}
                      <h2 className="font-cooper text-xl leading-tight tracking-wide text-black dark:text-white">{policy.title}</h2>
                      <Text className="flex-1 text-sm">{toMetaDescription(htmlToText(body), 140)}</Text>
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-black underline-offset-4 group-hover:underline dark:text-white">
                        Read policy
                        <FiArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-0.5 motion-reduce:transition-none" />
                      </span>
                    </Link>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-10">
            <EmptyState message="No policies posted yet. Ryan is still reading the fine print." />
          </div>
        )}
      </div>
    </main>
  );
}
