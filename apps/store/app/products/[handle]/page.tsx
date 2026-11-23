import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs, type Breadcrumb } from "@ryanmeetup/ui";
import { FiShoppingBag } from "react-icons/fi";
import { NavSection } from "@/components/nav-section";
import { ProductDetail } from "@/components/product-detail";
import { ProductGroupDetail } from "@/components/product-group-detail";
import { JsonLd } from "@/components/json-ld";
import { ProductSchema } from "@/components/product-schema";
import { RelatedListings } from "@/components/related-listings";
import { Reviews } from "@/components/reviews";
import { getCollectionPath, getProductTypeCollection } from "@/lib/catalog-collections";
import { buildPageMetadata, DEFAULT_IMAGE, getProductMetaDescription, SITE_URL, toMetadataImage } from "@/lib/metadata";
import { formatMoney } from "@/lib/money";
import { findGarment, getGarmentPath } from "@/lib/garments";
import { getGarmentIcon, getStoreCollectionIcon, StoreHomeIcon, StoreProductIcon } from "@/lib/navigation";
import { decodeRouteHandle } from "@/lib/handles";
import { getColorListingHref, getColorPreview } from "@/lib/product-colors";
import { getProductGroupForMember, getProductHref, resolveProductDesignValue } from "@/lib/product-groups";
import { getCustomReviews } from "@/lib/custom-reviews";
import { describeShippingRegions, getProductionSummary } from "@/lib/product-guidance";
import { getCustomReviewAccessByProduct } from "@/lib/custom-review-access";
import { cartOrigin, withProductOrigin } from "@/lib/product-origin";
import { getCanonicalProductHrefs, getCollections, getPolicies, getProduct, getProductHandles, getShippingCountries } from "@/lib/shopify";
import { buildBreadcrumbSchema } from "@/lib/structured-data";

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<{ design?: string; color?: string; from?: string }> };

export async function generateStaticParams() {
  return (await getProductHandles()).map((handle) => ({ handle }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const handle = decodeRouteHandle((await params).handle);
  const product = await getProduct(handle);
  if (!product) return { title: "Product not found" };
  if (getProductGroupForMember(product)) return {};
  return buildPageMetadata({
    title: product.title,
    description: getProductMetaDescription(product),
    canonical: `/products/${product.handle}`,
    image: product.featuredImage ? toMetadataImage(product.featuredImage, product.title) : DEFAULT_IMAGE,
  });
}

export default async function ProductPage({ params, searchParams }: Props) {
  const handle = decodeRouteHandle((await params).handle);
  const product = await getProduct(handle);
  if (!product) notFound();
  const query = await searchParams;
  // A member's own URL goes straight to its listing, by color when the listing is split by color.
  if (getProductGroupForMember(product)) permanentRedirect(withProductOrigin((await getCanonicalProductHrefs([product]))(product, query.color ? [query.color] : undefined), query.from));
  if (product.handle !== handle) {
    // A renamed listing keeps the requested design and color.
    const search = new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === "string" && (Boolean(product.designs) || entry[0] === "from"))).toString();
    permanentRedirect(`${getProductHref(product)}${search ? `?${search}` : ""}`);
  }
  const originalDesign = product.designs ? query.design : undefined;
  const requestedDesign = originalDesign ? resolveProductDesignValue(product.handle, originalDesign) : undefined;
  if (requestedDesign && requestedDesign !== originalDesign) {
    const color = query.color ? `&color=${encodeURIComponent(query.color)}` : "";
    permanentRedirect(withProductOrigin(`/products/${product.handle}?design=${encodeURIComponent(requestedDesign)}${color}`, query.from));
  }
  // Member, cart, and older links name the printing product; a color-split listing's URL names only the color.
  const colorHref = requestedDesign ? getColorListingHref(product, requestedDesign, query.color) : undefined;
  if (colorHref) permanentRedirect(withProductOrigin(colorHref, query.from));
  const reviewProducts = product.designs?.map((design) => design.product) ?? [product];
  const [reviewEntries, reviewAccess, policies, shippingCountries] = await Promise.all([
    Promise.all(reviewProducts.map(async (item) => [item.id, await getCustomReviews(item.id)] as const)),
    getCustomReviewAccessByProduct(reviewProducts, `/products/${product.handle}`),
    getPolicies().catch((error: unknown) => {
      console.error("Could not load product shipping guidance.", error);
      return [];
    }),
    // Without Markets the country line is left out; it never blocks the product page.
    getShippingCountries().catch((error: unknown) => {
      console.error("Could not load shipping countries for the product page.", error);
      return [];
    }),
  ]);
  const productionSummary = getProductionSummary(policies);
  const shipsTo = describeShippingRegions(shippingCountries);
  const reviewsByProduct = Object.fromEntries(reviewEntries);
  const originCrumbs = await getOriginCrumbs(query.from);
  const typeCollection = getProductTypeCollection(product);
  const productUrl = `${SITE_URL}/products/${product.handle}`;
  const breadcrumbs = <Breadcrumbs variant="compact" crumbs={[{ href: "/", title: "Store", icon: <StoreHomeIcon aria-hidden className="shrink-0" /> }, ...originCrumbs, { href: `/products/${product.handle}`, title: product.title, current: true, icon: <StoreProductIcon aria-hidden className="shrink-0" /> }]} />;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <NavSection href={typeCollection ? getCollectionPath(typeCollection.handle) : null} />
      <JsonLd data={buildBreadcrumbSchema([
        { name: "Store", path: "/" },
        ...(typeCollection ? [{ name: typeCollection.title, path: getCollectionPath(typeCollection.handle) }] : []),
        { name: product.title, path: `/products/${product.handle}` },
      ])} />
      {product.designs ? (
        <ProductGroupDetail title={product.title} handle={product.handle} url={productUrl} breadcrumbs={breadcrumbs} designs={product.designs} defaultColor={product.defaultColor} reviewsByProduct={reviewsByProduct} reviewAccessByProduct={reviewAccess} productionSummary={productionSummary} shipsTo={shipsTo} />
      ) : (
        <>
          <ProductSchema product={product} reviews={reviewsByProduct[product.id]} url={productUrl} />
          <ProductDetail product={product} breadcrumbs={breadcrumbs} initialColor={query.color} initialImage={getColorPreview(product, query.color)?.image} productionSummary={productionSummary} shipsTo={shipsTo} />
          <Reviews data={reviewsByProduct[product.id]} product={product} access={reviewAccess[product.id]} />
        </>
      )}
      <Suspense fallback={null}><RelatedListings product={product} /></Suspense>
      <p className="sr-only">Price: {formatMoney(product.priceRange.minVariantPrice)}</p>
    </main>
  );
}

async function getOriginCrumbs(from: string | undefined): Promise<Breadcrumb[]> {
  if (!from) return [];
  if (from === cartOrigin) return [{ href: "/cart", title: "Cart", icon: <FiShoppingBag aria-hidden className="shrink-0" /> }];
  // A garment page passes `apparel/hats`, which trails through its department.
  const [handle, garmentHandle] = from.split("/");
  // An unknown handle is dropped rather than trusted as a crumb title.
  const collection = (await getCollections()).find((entry) => entry.handle === handle);
  if (!collection) return [];
  const crumb = { href: getCollectionPath(collection.handle), title: collection.title, icon: getStoreCollectionIcon(collection.handle) };
  const garment = garmentHandle ? findGarment(handle, garmentHandle) : undefined;
  return garment ? [crumb, { href: getGarmentPath(handle, garment.handle), title: garment.title, icon: getGarmentIcon(handle, garment.handle) }] : [crumb];
}
