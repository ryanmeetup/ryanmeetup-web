import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs, SectionHeader } from "@ryanmeetup/ui";
import { CollectionGrid } from "@/components/collection-grid";
import { decodeRouteHandle, normalizeHandle } from "@/lib/handles";
import { buildPageMetadata, DEFAULT_IMAGE, toMetadataImage, toMetaDescription } from "@/lib/metadata";
import { getStoreCollectionIcon, StoreHomeIcon } from "@/lib/navigation";
import { getCollection, getCollections } from "@/lib/shopify";

type Props = { params: Promise<{ handle: string }> };

export async function generateStaticParams() {
  return (await getCollections()).map((collection) => ({ handle: collection.handle }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const handle = normalizeHandle(decodeRouteHandle((await params).handle));
  const result = await getCollection(handle);
  if (!result) return { title: "Collection not found" };
  const { collection } = result;
  const image = collection.image ?? result.products.find((product) => product.featuredImage)?.featuredImage;
  return buildPageMetadata({
    title: collection.title,
    // Some Shopify collections have no description written yet.
    description: toMetaDescription(collection.description || `Shop ${collection.title.toLowerCase()} from the official Ryan Meetup store.`),
    canonical: `/collections/${collection.handle}`,
    image: image ? toMetadataImage(image, collection.title) : DEFAULT_IMAGE,
  });
}

export default async function CollectionPage({ params }: Props) {
  const requested = decodeRouteHandle((await params).handle);
  const handle = normalizeHandle(requested);
  if (handle !== requested) permanentRedirect(`/collections/${handle}`);
  const result = await getCollection(handle);
  if (!result) notFound();
  return (
    <main className="store-container py-10 sm:py-14">
      <Breadcrumbs variant="compact" crumbs={[{ href: "/", title: "Store", icon: <StoreHomeIcon aria-hidden className="shrink-0" /> }, { href: `/collections/${handle}`, title: result.collection.title, current: true, icon: getStoreCollectionIcon(handle) }]} />
      <SectionHeader className="mt-8" headingLevel="h1" title={result.collection.title} description={result.collection.description} meta={`${result.products.length} item${result.products.length === 1 ? "" : "s"}`} headingClassName="text-4xl sm:text-6xl" />
      <div className="mt-10"><CollectionGrid handle={handle} products={result.products} sections={result.sections} more={result.more} /></div>
    </main>
  );
}
