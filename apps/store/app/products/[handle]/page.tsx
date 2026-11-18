import { headers } from "next/headers";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs, type Breadcrumb } from "@ryanmeetup/ui";
import { FiShoppingBag } from "react-icons/fi";
import { NavSection } from "@/components/nav-section";
import { ProductDetail } from "@/components/product-detail";
import { ProductGroupDetail } from "@/components/product-group-detail";
import { Reviews } from "@/components/reviews";
import { getCollectionPath, getProductTypeCollection } from "@/lib/catalog-collections";
import { buildPageMetadata, DEFAULT_IMAGE, getProductMetaDescription, SITE_URL, toMetadataImage } from "@/lib/metadata";
import { formatMoney } from "@/lib/money";
import { findGarment, getGarmentPath } from "@/lib/garments";
import { getGarmentIcon, getStoreCollectionIcon, StoreHomeIcon, StoreProductIcon } from "@/lib/navigation";
import { decodeRouteHandle } from "@/lib/handles";
import { getColorPreview } from "@/lib/product-colors";
import { getProductGroupForMember, getProductHref, resolveProductDesignValue } from "@/lib/product-groups";
import { getReviews } from "@/lib/reviews";
import { getReviewAccount } from "@/lib/review-collection";
import { getCustomReviewAccess, type CustomReviewAccess } from "@/lib/custom-review-access";
import { getCustomerAccountSession } from "@/lib/customer-account/runtime";
import { findReviewablePurchases } from "@/lib/review-purchases";
import { getActiveReviewProvider, getReviewPreview } from "@/lib/review-preview";
import { cartOrigin, withProductOrigin } from "@/lib/product-origin";
import { getCollections, getProduct, getProductHandles } from "@/lib/shopify";

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

/** Session loading needs a Request; rebuild one from this page request's headers. */
async function currentRequest(path: string) {
  const incoming = await headers();
  const host = incoming.get("host") ?? "localhost";
  const protocol = incoming.get("x-forwarded-proto")?.split(",")[0].trim() ?? "https";
  return new Request(`${protocol}://${host}${path}`, { headers: incoming });
}

/** One session load per page, then each listed product's own purchases. */
async function getCustomReviewAccessByProduct(products: { id: string }[], productPath: string) {
  const request = await currentRequest(productPath);
  let session: ReturnType<typeof getCustomerAccountSession> | undefined;
  const loadSession = () => (session ??= getCustomerAccountSession(request));
  const entries = await Promise.all(products.map(async (item) =>
    [item.id, await getCustomReviewAccess({ productId: item.id, productPath, loadSession, findPurchases: findReviewablePurchases })] as const));
  return Object.fromEntries(entries) as Record<string, CustomReviewAccess>;
}

export default async function ProductPage({ params, searchParams }: Props) {
  const handle = decodeRouteHandle((await params).handle);
  const product = await getProduct(handle);
  if (!product) notFound();
  const query = await searchParams;
  if (getProductGroupForMember(product)) permanentRedirect(withProductOrigin(getProductHref(product), query.from));
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
  const selectedDesign = product.designs?.find((design) => design.value === requestedDesign);
  const reviewProducts = product.designs?.map((design) => design.product) ?? [product];
  const [reviewEntries, reviewAccount, reviewPreview, customReviewAccess] = await Promise.all([
    Promise.all(reviewProducts.map(async (item) => [item.id, await getReviews(item.id)] as const)),
    getReviewAccount(),
    getReviewPreview(),
    getActiveReviewProvider().then((provider) => (provider === "custom" ? getCustomReviewAccessByProduct(reviewProducts, `/products/${product.handle}`) : undefined)),
  ]);
  const reviewsByProduct = Object.fromEntries(reviewEntries);
  const reviewCount = Object.values(reviewsByProduct).reduce((count, reviews) => count + reviews.count, 0);
  const totalRating = Object.values(reviewsByProduct).reduce((total, reviews) => total + reviews.averageRating * reviews.count, 0);
  const originCrumbs = await getOriginCrumbs(query.from);
  const typeCollection = getProductTypeCollection(product);
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: (selectedDesign?.product ?? product).images.map((image) => image.url),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: product.priceRange.minVariantPrice.currencyCode,
      lowPrice: product.priceRange.minVariantPrice.amount,
      offerCount: product.variants.length,
      availability: product.availableForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${SITE_URL}/products/${product.handle}`,
    },
    ...(reviewCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: (totalRating / reviewCount).toFixed(1), reviewCount } } : {}),
  };
  const breadcrumbs = <Breadcrumbs variant="compact" crumbs={[{ href: "/", title: "Store", icon: <StoreHomeIcon aria-hidden className="shrink-0" /> }, ...originCrumbs, { href: `/products/${product.handle}`, title: product.title, current: true, icon: <StoreProductIcon aria-hidden className="shrink-0" /> }]} />;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <NavSection href={typeCollection ? getCollectionPath(typeCollection.handle) : null} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema).replace(/</g, "\\u003c") }} />
      {product.designs ? (
        <ProductGroupDetail title={product.title} handle={product.handle} breadcrumbs={breadcrumbs} designs={product.designs} defaultColor={product.defaultColor} reviewsByProduct={reviewsByProduct} reviewAccount={reviewAccount} reviewPreview={reviewPreview} customReviewAccessByProduct={customReviewAccess} />
      ) : (
        <>
          <ProductDetail product={product} breadcrumbs={breadcrumbs} initialColor={query.color} initialImage={getColorPreview(product, query.color)?.image} />
          <Reviews data={reviewsByProduct[product.id]} product={product} reviewAccount={reviewAccount} reviewPreview={reviewPreview} customAccess={customReviewAccess?.[product.id]} />
        </>
      )}
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
