import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, SectionHeader } from "@ryanmeetup/ui";
import { CollectionGrid } from "@/components/collection-grid";
import { JsonLd } from "@/components/json-ld";
import { getCatalogCollection, getCollectionPath } from "@/lib/catalog-collections";
import { getGarmentParams, getGarmentPath } from "@/lib/garments";
import { toCardCatalog } from "@/lib/listing-card";
import { withListingRatings } from "@/lib/listing-ratings";
import { withListingHighlights } from "@/lib/product-activity";
import { buildPageMetadata, DEFAULT_IMAGE, toMetadataImage, toMetaDescription } from "@/lib/metadata";
import { getGarmentIcon, getStoreCollectionIcon, StoreHomeIcon } from "@/lib/navigation";
import { getGarmentCollection } from "@/lib/shopify";
import { buildBreadcrumbSchema } from "@/lib/structured-data";

// One garment grouping of Apparel or Accessories, such as /apparel/hats.
type Props = { params: Promise<{ department: string; garment: string }> };

export function generateStaticParams() {
  return getGarmentParams();
}

export const dynamicParams = false;

// An empty grouping, such as Home Goods after its only door mat is archived, is a 404
// rather than a page that says "0 items"; the header menu leaves it out too.
async function getStockedGarmentCollection(department: string, garment: string) {
  const result = await getGarmentCollection(department, garment);
  return result?.products.length ? result : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { department: handle, garment } = await params;
  const result = await getStockedGarmentCollection(handle, garment);
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
  const { department: handle, garment } = await params;
  const department = getCatalogCollection(handle);
  const found = await getStockedGarmentCollection(handle, garment);
  if (!department || !found) notFound();
  const result = toCardCatalog(await withListingHighlights(await withListingRatings(found)));
  return (
    <main className="store-container py-10 sm:py-14">
      <JsonLd data={buildBreadcrumbSchema([{ name: "Store", path: "/" }, { name: department.title, path: getCollectionPath(handle) }, { name: result.collection.title, path: getGarmentPath(handle, garment) }])} />
      <Breadcrumbs
        variant="compact"
        crumbs={[
          { href: "/", title: "Store", icon: <StoreHomeIcon aria-hidden className="shrink-0" /> },
          { href: getCollectionPath(handle), title: department.title, icon: getStoreCollectionIcon(handle) },
          { href: getGarmentPath(handle, garment), title: result.collection.title, current: true, icon: getGarmentIcon(handle, garment) },
        ]}
      />
      <SectionHeader align="left" layout="split" className="mt-3" headingLevel="h1" title={result.collection.title} description={result.collection.description} headingClassName="text-4xl sm:text-6xl" />
      <div className="mt-6"><CollectionGrid handle={`${handle}/${garment}`} products={result.products} /></div>
    </main>
  );
}
