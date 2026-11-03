import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, SectionHeader } from "@ryanmeetup/ui";
import { CollectionGrid } from "@/components/collection-grid";
import { getStoreCollectionIcon, StoreHomeIcon } from "@/lib/navigation";
import { getCollection, getCollections } from "@/lib/shopify";

type Props = { params: Promise<{ handle: string }> };

// Shopify handles can contain non-ASCII characters such as emoji, which reach the
// route still percent-encoded.
async function getHandle(params: Props["params"]) {
  const { handle } = await params;
  try {
    return decodeURIComponent(handle);
  } catch {
    return handle;
  }
}

export async function generateStaticParams() {
  return (await getCollections()).map((collection) => ({ handle: collection.handle }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const handle = await getHandle(params);
  const result = await getCollection(handle);
  if (!result) return { title: "Collection not found" };
  return { title: result.collection.title, description: result.collection.description };
}

export default async function CollectionPage({ params }: Props) {
  const handle = await getHandle(params);
  const result = await getCollection(handle);
  if (!result) notFound();
  return (
    <main className="store-container py-10 sm:py-14">
      <Breadcrumbs variant="compact" crumbs={[{ href: "/", title: "Store", icon: <StoreHomeIcon aria-hidden className="shrink-0" /> }, { href: `/collections/${handle}`, title: result.collection.title, current: true, icon: getStoreCollectionIcon(handle) }]} />
      <SectionHeader className="mt-8" headingLevel="h1" title={result.collection.title} description={result.collection.description} meta={`${result.products.length} item${result.products.length === 1 ? "" : "s"}`} headingClassName="text-4xl sm:text-6xl" />
      <div className="mt-10"><CollectionGrid products={result.products} /></div>
    </main>
  );
}
