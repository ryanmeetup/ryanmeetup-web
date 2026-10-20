import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@ryanmeetup/ui";
import { ProductDetail } from "@/components/product-detail";
import { ProductGroupDetail } from "@/components/product-group-detail";
import { Reviews } from "@/components/reviews";
import { formatMoney } from "@/lib/money";
import { StoreCollectionIcon, StoreHomeIcon, StoreProductIcon } from "@/lib/navigation";
import { getColorPreview } from "@/lib/product-colors";
import { getProductGroupForMember, getProductHref, resolveProductDesignValue } from "@/lib/product-groups";
import { getReviews } from "@/lib/reviews";
import { getProduct, getProductHandles } from "@/lib/shopify";

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<{ design?: string; color?: string }> };

export async function generateStaticParams() {
  return (await getProductHandles()).map((handle) => ({ handle }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) return { title: "Product not found" };
  if (getProductGroupForMember(product)) return {};
  return {
    title: product.title,
    description: product.description,
    alternates: { canonical: `/products/${product.handle}` },
    openGraph: { images: product.featuredImage ? [{ url: product.featuredImage.url, alt: product.featuredImage.altText || product.title }] : [] },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) notFound();
  if (getProductGroupForMember(product) || product.handle !== handle) permanentRedirect(getProductHref(product));
  const query = await searchParams;
  const originalDesign = product.designs ? query.design : undefined;
  const requestedDesign = originalDesign ? resolveProductDesignValue(product.handle, originalDesign) : undefined;
  if (requestedDesign && requestedDesign !== originalDesign) {
    const color = query.color ? `&color=${encodeURIComponent(query.color)}` : "";
    permanentRedirect(`/products/${product.handle}?design=${encodeURIComponent(requestedDesign)}${color}`);
  }
  const selectedDesign = product.designs?.find((design) => design.value === requestedDesign);
  const reviewProducts = product.designs?.map((design) => design.product) ?? [product];
  const reviewsByProduct = Object.fromEntries(await Promise.all(reviewProducts.map(async (item) => [item.id, await getReviews(item.id)] as const)));
  const reviewCount = Object.values(reviewsByProduct).reduce((count, reviews) => count + reviews.count, 0);
  const totalRating = Object.values(reviewsByProduct).reduce((total, reviews) => total + reviews.averageRating * reviews.count, 0);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://store.ryanmeetup.com";
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
      url: `${siteUrl}/products/${product.handle}`,
    },
    ...(reviewCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: (totalRating / reviewCount).toFixed(1), reviewCount } } : {}),
  };
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema).replace(/</g, "\\u003c") }} />
      <Breadcrumbs variant="compact" crumbs={[{ href: "/", title: "Store", icon: <StoreHomeIcon aria-hidden className="shrink-0" /> }, { href: "/collections/all", title: "All goods", icon: <StoreCollectionIcon aria-hidden className="shrink-0" /> }, { href: `/products/${product.handle}`, title: product.title, current: true, icon: <StoreProductIcon aria-hidden className="shrink-0" /> }]} />
      {product.designs ? (
        <div className="mt-8"><ProductGroupDetail title={product.title} handle={product.handle} designs={product.designs} reviewsByProduct={reviewsByProduct} /></div>
      ) : (
        <>
          <div className="mt-8"><ProductDetail product={product} initialImage={getColorPreview(product, query.color)?.image} /></div>
          <Reviews data={reviewsByProduct[product.id]} productId={product.id} />
        </>
      )}
      <p className="sr-only">Price: {formatMoney(product.priceRange.minVariantPrice)}</p>
    </main>
  );
}
