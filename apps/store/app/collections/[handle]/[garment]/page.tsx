import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, SectionHeader } from "@ryanmeetup/ui";
import { CollectionGrid } from "@/components/collection-grid";
import { getCatalogCollection } from "@/lib/catalog-collections";
import { getGarmentParams, getGarmentPath } from "@/lib/garments";
import { buildPageMetadata, DEFAULT_IMAGE, toMetadataImage, toMetaDescription } from "@/lib/metadata";
import { getGarmentIcon, getStoreCollectionIcon, StoreHomeIcon } from "@/lib/navigation";
import { getGarmentCollection } from "@/lib/shopify";

// One garment grouping of Apparel or Accessories, such as /collections/apparel/hats.
type Props = { params: Promise<{ handle: string; garment: string }> };

export function generateStaticParams() {
  return getGarmentParams();
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle, garment } = await params;
  const result = await getGarmentCollection(handle, garment);
  if (!result) return { title: "Collection not found" };
  const { collection } = result;
  const image = result.products.find((product) => product.featuredImage)?.featuredImage;
  return buildPageMetadata({
    title: collection.title,
    description: toMetaDescription(collection.description),
    canonical: getGarmentPath(handle, garment),
    image: image ? toMetadataImage(image, collection.title) : DEFAULT_IMAGE,
  });
}

export default async function GarmentPage({ params }: Props) {
  const { handle, garment } = await params;
  const department = getCatalogCollection(handle);
  const result = await getGarmentCollection(handle, garment);
  if (!department || !result) notFound();
  return (
    <main className="store-container py-10 sm:py-14">
      <Breadcrumbs
        variant="compact"
        crumbs={[
          { href: "/", title: "Store", icon: <StoreHomeIcon aria-hidden className="shrink-0" /> },
          { href: `/collections/${handle}`, title: department.title, icon: getStoreCollectionIcon(handle) },
          { href: getGarmentPath(handle, garment), title: result.collection.title, current: true, icon: getGarmentIcon(handle, garment) },
        ]}
      />
      <SectionHeader className="mt-3" headingLevel="h1" title={result.collection.title} description={result.collection.description} meta={`${result.products.length} item${result.products.length === 1 ? "" : "s"}`} headingClassName="text-4xl sm:text-6xl" />
      <div className="mt-10"><CollectionGrid handle={`${handle}/${garment}`} products={result.products} /></div>
    </main>
  );
}
