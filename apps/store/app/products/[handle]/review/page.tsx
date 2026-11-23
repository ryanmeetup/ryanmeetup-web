import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { Breadcrumbs } from "@ryanmeetup/ui";
import { FiEdit2 } from "react-icons/fi";
import { WriteReviewRoute } from "@/components/review-route";
import { getCustomReviewAccessByProduct } from "@/lib/custom-review-access";
import { decodeRouteHandle } from "@/lib/handles";
import { buildPageMetadata, DEFAULT_IMAGE, toMetadataImage } from "@/lib/metadata";
import { StoreHomeIcon, StoreProductIcon } from "@/lib/navigation";
import { reviewRouteHref } from "@/lib/review-links";
import { getCanonicalProductHrefs, getProduct } from "@/lib/shopify";

type Query = { order?: string | string[]; from?: string | string[] };
type Props = { params: Promise<{ handle: string }>; searchParams: Promise<Query> };

const single = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const handle = decodeRouteHandle((await params).handle);
  const product = await getProduct(handle);
  if (!product) return { title: "Product not found" };
  return buildPageMetadata({
    title: `Review ${product.title}`,
    description: `Tell the other Ryans how the ${product.title} fits, feels, and holds up.`,
    canonical: reviewRouteHref(product.handle),
    image: product.featuredImage ? toMetadataImage(product.featuredImage, product.title) : DEFAULT_IMAGE,
    robots: { index: false, follow: false },
  });
}

/**
 * The review form as a page, for phones. The product page and Ready to Review
 * keep the dialog from `sm` up; below it, their "Write a review" links here so
 * the form gets the whole screen and scrolls like any page. `order` preselects
 * one purchase by its order name, and `from=mine` returns to My reviews.
 *
 * It reviews the product its handle names, including one design of a
 * multi-design listing, since each design is reviewed as its own product.
 */
export default async function WriteReviewPage({ params, searchParams }: Props) {
  const handle = decodeRouteHandle((await params).handle);
  const product = await getProduct(handle);
  if (!product) notFound();
  const query = await searchParams;
  const order = single(query.order);
  const fromMine = single(query.from) === "mine";
  // A renamed product keeps the requested order and return.
  if (product.handle !== handle) permanentRedirect(reviewRouteHref(product.handle, { order, from: fromMine ? "mine" : undefined }));
  // A multi-design listing has no reviews of its own; each design does, on the listing page.
  if (product.designs) redirect(`/products/${product.handle}#reviews`);

  const path = reviewRouteHref(product.handle, { order, from: fromMine ? "mine" : undefined });
  const [access, canonicalHref] = await Promise.all([
    getCustomReviewAccessByProduct([product], path).then((entries) => entries[product.id]),
    getCanonicalProductHrefs([product]),
  ]);
  const productHref = canonicalHref(product);
  // One purchase in the named order is preselected; several in it leave the choice to the buyer.
  const inOrder = order && access.status === "ready"
    ? access.purchases.filter((purchase) => purchase.orderLabel?.replace(/^#/, "") === order.replace(/^#/, "")) : [];

  return (
    <main className="store-container space-y-8 py-10 sm:py-14">
      {/* The trail is where the form sits, whichever page opened it; Cancel and the confirmation retrace the buyer's steps. */}
      <Breadcrumbs variant="compact" crumbs={[
        { href: "/", title: "Store", icon: <StoreHomeIcon aria-hidden className="shrink-0" /> },
        { href: productHref, title: product.title, icon: <StoreProductIcon aria-hidden className="shrink-0" /> },
        { href: path, title: "Write a review", current: true, icon: <FiEdit2 aria-hidden className="shrink-0" /> },
      ]} />
      <WriteReviewRoute
        access={access}
        product={product}
        productId={product.id}
        backHref={fromMine ? "/reviews/mine" : `${productHref}#reviews`}
        backLabel={fromMine ? "Back to My reviews" : "Back to the product"}
        initialLineId={inOrder.length === 1 ? inOrder[0].lineId : undefined}
      />
    </main>
  );
}
