import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, SectionHeader } from "@ryanmeetup/ui";
import { CollectionGrid } from "@/components/collection-grid";
import { departments, getCollectionPath, isDepartment } from "@/lib/catalog-collections";
import { buildPageMetadata, DEFAULT_IMAGE, toMetadataImage, toMetaDescription } from "@/lib/metadata";
import { getStoreCollectionIcon, StoreHomeIcon } from "@/lib/navigation";
import { getCollection } from "@/lib/shopify";

// Apparel and Accessories, the type pages split into garment sections, such as /apparel.
type Props = { params: Promise<{ department: string }> };

export function generateStaticParams() {
  return departments.map(({ handle }) => ({ department: handle }));
}

// Only the departments live here; every other top-level path is a 404.
export const dynamicParams = false;

async function getDepartment(handle: string) {
  return isDepartment(handle) ? getCollection(handle) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { department } = await params;
  const result = await getDepartment(department);
  if (!result) return { title: "Collection not found" };
  const { collection } = result;
  const image = result.products.find((product) => product.featuredImage)?.featuredImage;
  return buildPageMetadata({
    title: collection.title,
    description: toMetaDescription(collection.description),
    canonical: getCollectionPath(department),
    image: image ? toMetadataImage(image, collection.title) : DEFAULT_IMAGE,
  });
}

export default async function DepartmentPage({ params }: Props) {
  const { department } = await params;
  const result = await getDepartment(department);
  if (!result) notFound();
  return (
    <main className="store-container py-10 sm:py-14">
      <Breadcrumbs variant="compact" crumbs={[{ href: "/", title: "Store", icon: <StoreHomeIcon aria-hidden className="shrink-0" /> }, { href: getCollectionPath(department), title: result.collection.title, current: true, icon: getStoreCollectionIcon(department) }]} />
      <SectionHeader align="left" layout="split" className="mt-3" headingLevel="h1" title={result.collection.title} description={result.collection.description} meta={`${result.products.length} item${result.products.length === 1 ? "" : "s"}`} headingClassName="text-4xl sm:text-6xl" />
      <div className="mt-10"><CollectionGrid handle={department} products={result.products} sections={result.sections} more={result.more} /></div>
    </main>
  );
}
