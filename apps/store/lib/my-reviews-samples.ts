import type { BuyerReview, BuyerReviewStatus, ReviewNameStyle } from "@ryanmeetup/reviews";
import { demoProductId, demoProducts } from "./demo-data";
import type { MyReviewProduct } from "./my-review-view";
import type { ReviewSuggestion } from "./review-suggestions";

/**
 * Sample buyer reviews and purchases for previewing /reviews/mine by hand:
 * the dev-only mock on that page and `npm run preview:my-reviews` both use
 * them. Synthetic data only; nothing here is a real buyer or order.
 */

export const SAMPLE_BUYER = { firstName: "Ryan", lastName: "Example" };
const names: Record<ReviewNameStyle, string> = { full: "Ryan Example", "first-initial": "Ryan E.", anonymous: "Anonymous" };

const DAY = 86400000;
/** Database versions carry microseconds; the store rejects anything else. */
const version = (now: number, daysAgo: number, n: number) => new Date(now - daysAgo * DAY + n * 1000).toISOString().replace(/Z$/, "123Z");
const iso = (now: number, daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const numeric = (gid: string) => gid.split("/").pop()!;
function demo(handle: string) {
  const found = demoProducts.find((product) => product.handle === handle);
  if (!found) throw new Error(`No demo product ${handle}`);
  return found;
}

type Sample = {
  n: number; status: BuyerReviewStatus; daysAgo: number; rating: number; title: string; body: string;
  nameStyle?: ReviewNameStyle; verified?: boolean; pendingEdit?: boolean;
} & ({ handle: string; variant?: string | null } | { offStorefront: { title: string; variant: string | null } });

function review(now: number, sample: Sample): BuyerReview {
  const item = "handle" in sample
    ? { productId: numeric(demoProductId(sample.handle)), productTitle: demo(sample.handle).title, variantTitle: sample.variant ?? null }
    : { productId: String(8000000000 + sample.n), productTitle: sample.offStorefront.title, variantTitle: sample.offStorefront.variant };
  const nameStyle = sample.nameStyle ?? "first-initial";
  return {
    id: uuid(sample.n), lineId: sample.verified === false ? null : String(9000 + sample.n), item, status: sample.status,
    hasPendingEdit: sample.status === "published" && Boolean(sample.pendingEdit),
    publishedAt: sample.status === "published" ? iso(now, sample.daysAgo - 1) : null,
    createdAt: version(now, sample.daysAgo, sample.n), updatedAt: version(now, sample.daysAgo, sample.n),
    current: { rating: sample.rating as BuyerReview["current"]["rating"], title: sample.title, body: sample.body, nameStyle, displayName: names[nameStyle] },
  };
}

const everyStatus: Sample[] = [
  { n: 1, status: "pending", daysAgo: 1, handle: "ryan-meetup-tee", variant: "M / Black", rating: 5, nameStyle: "anonymous",
    title: "Wore it to three Ryan meetups", body: "Soft, fits true to size, and strangers named Ryan keep nodding at me." },
  { n: 2, status: "published", daysAgo: 6, handle: "hello-my-name-is-ryan-sweatshirt", variant: "L / Cream", rating: 5, nameStyle: "full",
    title: "Warmest name tag I own", body: "Thick, cozy, and saves me introducing myself." },
  { n: 3, status: "published", daysAgo: 12, pendingEdit: true, handle: "ryan-name-tag-shirt", variant: "S / White", rating: 4,
    title: "Still great after a dozen washes", body: "Updated: the print hasn't faded at all. Knocked one star off because I wanted it in more colours." },
  { n: 4, status: "rejected", daysAgo: 15, verified: false, handle: "ryans-dad-name-tag-shirt", variant: null, rating: 1,
    title: "Not my dad", body: "Bought it for my dad. His name is Steve." },
  { n: 5, status: "hidden", daysAgo: 21, handle: "certified-ryan-tote", variant: "One size / Natural", rating: 3,
    title: "Holds a lot of Ryans", body: "Roomy tote, a little thin." },
  { n: 6, status: "withdrawn", daysAgo: 40, offStorefront: { title: "RyanCon 2025 Lanyard", variant: null }, rating: 4,
    title: "Classic lanyard", body: "No longer in the shop, so this one shows the fallback thumbnail." },
];

const longText: Sample[] = [
  { n: 20, status: "pending", daysAgo: 2, rating: 5,
    offStorefront: { title: "The Extremely Limited Commemorative RyanCon Founders' Edition Heavyweight Garment-Dyed Crewneck Sweatshirt", variant: "2XL / Washed Charcoal With Contrast Stitching" },
    title: "A title long enough to check that review titles wrap politely instead of overflowing on phones",
    body: Array.from({ length: 5 }, (_, i) => `Paragraph ${i + 1}. This review keeps going so the body wraps across several lines at every width, including phones.`).join("\n\n") },
  ...everyStatus.slice(1, 3),
];

function many(): Sample[] {
  const handles = demoProducts.map((product) => product.handle);
  const statuses: BuyerReviewStatus[] = ["pending", "published", "published", "rejected", "hidden", "withdrawn"];
  return Array.from({ length: 125 }, (_, i) => ({
    n: 100 + i, status: statuses[i % statuses.length], daysAgo: 1 + i, handle: handles[i % handles.length], variant: null,
    rating: 1 + (i % 5), title: `Review number ${i + 1}`, body: `Sample review ${i + 1} of 125, for paging through Load more.`,
  }));
}

/** One purchase the buyer hasn't reviewed yet, already resolved the way the page receives it. */
export type SamplePurchase = { handle: string; variant: string; orderNumber: number; quantity: number; shippedDaysAgo: number };
const purchases: SamplePurchase[] = [
  { handle: "ryan-society-cap", variant: "One size / Navy", orderNumber: 1001, quantity: 1, shippedDaysAgo: 2 },
  { handle: "ryans-dad-name-tag-shirt", variant: "L / Natural", orderNumber: 1002, quantity: 2, shippedDaysAgo: 4 },
  { handle: "ryan-meetup-tee", variant: "XL / Black", orderNumber: 1003, quantity: 1, shippedDaysAgo: 9 },
];

export const SAMPLE_SCENARIOS = {
  everything: { label: "Everything", description: "Purchases to review, plus one review in every status." },
  "reviews-only": { label: "Reviews only", description: "Every review status, nothing left to review." },
  "to-review-only": { label: "To review only", description: "Purchases to review, no reviews yet." },
  single: { label: "One of each", description: "One purchase and one pending review." },
  "long-text": { label: "Long text", description: "Very long names, variants, titles and bodies." },
  many: { label: "125 reviews", description: "Paging with Load more." },
  empty: { label: "Empty", description: "No reviews and nothing to review." },
  "load-error": { label: "Load error", description: "The review list fails to load." },
  "signed-out": { label: "Signed out", description: "The sign-in prompt." },
} as const;
export type SampleScenario = keyof typeof SAMPLE_SCENARIOS;
export const isSampleScenario = (value: unknown): value is SampleScenario => typeof value === "string" && Object.hasOwn(SAMPLE_SCENARIOS, value);

/** The reviews and unreviewed purchases one scenario shows. */
export function sampleScenario(scenario: SampleScenario, now = Date.now()): { reviews: BuyerReview[]; purchases: SamplePurchase[] } {
  const reviews = (samples: Sample[]) => samples.map((sample) => review(now, sample));
  switch (scenario) {
    case "everything": case "load-error": return { reviews: reviews(everyStatus), purchases };
    case "reviews-only": return { reviews: reviews(everyStatus), purchases: [] };
    case "to-review-only": return { reviews: [], purchases };
    case "single": return { reviews: reviews(everyStatus.slice(0, 1)), purchases: purchases.slice(0, 1) };
    case "long-text": return { reviews: reviews(longText), purchases: [] };
    case "many": return { reviews: reviews(many()), purchases: [] };
    case "empty": case "signed-out": return { reviews: [], purchases: [] };
  }
}

/** Storefront cards for the demo products, as the page's `products` map; every demo product when `reviews` is omitted. */
export function sampleProducts(reviews?: BuyerReview[]): Record<string, MyReviewProduct> {
  return Object.fromEntries(demoProducts.flatMap((product) => {
    const id = numeric(product.id);
    return !reviews || reviews.some((item) => item.item.productId === id)
      ? [[id, { href: `/products/${product.handle}#reviews`, image: product.featuredImage ? { url: product.featuredImage.url, altText: product.featuredImage.altText ?? null } : null,
        options: product.options.map((option) => option.name) }]]
      : [];
  }));
}

/** Purchases in the shape the Ready to review section receives. */
export function sampleSuggestions(items: SamplePurchase[], now = Date.now()): ReviewSuggestion[] {
  return items.map((purchase) => {
    const product = demo(purchase.handle);
    const optionNames = product.options.map((option) => option.name);
    const values = purchase.variant.split(" / ");
    return {
      lineId: String(purchase.orderNumber * 10 + 1), productId: demoProductId(purchase.handle), productTitle: product.title,
      label: `Order #${purchase.orderNumber} · ${purchase.variant}`,
      options: values.length === optionNames.length ? values.map((value, index) => ({ name: optionNames[index], value })) : [{ name: null, value: purchase.variant }],
      orderLabel: `#${purchase.orderNumber}`, orderUrl: null, quantity: purchase.quantity, shippedAt: iso(now, purchase.shippedDaysAgo),
      href: `/products/${product.handle}#reviews`,
      image: product.featuredImage ? { url: product.featuredImage.url, altText: product.featuredImage.altText ?? null } : null,
    };
  });
}

export const sampleDisplayName = (style: ReviewNameStyle) => names[style];
