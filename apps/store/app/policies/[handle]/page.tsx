import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, Heading, Kicker } from "@ryanmeetup/ui";
import { FiFileText } from "react-icons/fi";
import { decodeRouteHandle } from "@/lib/handles";
import { StoreHomeIcon } from "@/lib/navigation";
import { getPolicies } from "@/lib/shopify";

type Props = { params: Promise<{ handle: string }> };

export async function generateStaticParams() {
  return (await getPolicies()).map((policy) => ({ handle: policy.handle }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const handle = decodeRouteHandle((await params).handle);
  const policy = (await getPolicies()).find((item) => item.handle === handle);
  if (!policy) return { title: "Policy not found" };
  return {
    title: policy.title,
    description: `The Ryan General Store ${policy.title.toLowerCase()}.`,
    alternates: { canonical: `/policies/${policy.handle}` },
  };
}

export default async function PolicyPage({ params }: Props) {
  const handle = decodeRouteHandle((await params).handle);
  const policies = await getPolicies();
  const policy = policies.find((item) => item.handle === handle);
  if (!policy) notFound();
  const otherPolicies = policies.filter((item) => item.handle !== policy.handle);
  return (
    <main className="store-container py-10 sm:py-14">
      {/* One centred reading column: legal copy keeps a readable measure
          without hugging the left edge of the wide store container. */}
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs variant="compact" crumbs={[{ href: "/", title: "Store", icon: <StoreHomeIcon aria-hidden className="shrink-0" /> }, { href: `/policies/${policy.handle}`, title: policy.title, current: true, icon: <FiFileText aria-hidden className="shrink-0" /> }]} />
        <article className="mt-8 space-y-8">
          <Heading size="h1" className="text-4xl leading-[1.05] sm:text-5xl">{policy.title}</Heading>
          {/* Written in Shopify Admin → Settings → Policies and supplied by the Storefront API.
              Links to the store itself become relative, so they stay on previews and local runs. */}
          <div className="rich-text" dangerouslySetInnerHTML={{ __html: policy.body.replace(/href="https:\/\/store\.ryanmeetup\.com(?=\/)/g, 'href="') }} />
        </article>
        {otherPolicies.length > 0 && (
          <nav aria-label="Other policies" className="mt-12 space-y-3 border-t border-black/10 pt-8 dark:border-white/10">
            <Kicker>Other policies</Kicker>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {otherPolicies.map((item) => (
                <li key={item.handle}>
                  <Link
                    href={`/policies/${item.handle}`}
                    className="rounded-sm font-semibold underline decoration-black/30 underline-offset-4 transition hover:decoration-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:decoration-white/30 dark:hover:decoration-white dark:focus-visible:ring-white/40"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </main>
  );
}
