import type { PublicReviewReply } from "@ryanmeetup/reviews";

export type Money = {
  amount: string;
  currencyCode: string;
};

export type StoreImage = {
  altText: string | null;
  height: number | null;
  url: string;
  width: number | null;
};

export type SelectedOption = {
  name: string;
  value: string;
};

export type ProductVariant = {
  availableForSale: boolean;
  id: string;
  image: StoreImage | null;
  price: Money;
  /** Set in Shopify to mark a markdown; only a value above `price` counts as a sale. */
  compareAtPrice?: Money | null;
  selectedOptions: SelectedOption[];
  title: string;
};

export type ProductOptionValue = {
  name: string;
  swatch: { color: string | null } | null;
};

export type ProductOption = {
  id: string;
  name: string;
  values: string[];
  optionValues?: ProductOptionValue[];
};

export type ProductCategory = { name: string; ancestors: { name: string }[] };

export type Product = {
  availableForSale: boolean;
  /** When the product was created in Shopify; sorts the Newest order. */
  createdAt?: string;
  description: string;
  descriptionHtml: string;
  featuredImage: StoreImage | null;
  handle: string;
  id: string;
  images: StoreImage[];
  options: ProductOption[];
  priceRange: { minVariantPrice: Money };
  productType: string;
  /** Shopify's standard product category; drives the garment groupings on department pages. */
  category?: ProductCategory | null;
  tags: string[];
  title: string;
  variants: ProductVariant[];
};

export type ProductDesign = {
  label: string;
  value: string;
  product: Product;
};

export type ProductListing = Product & {
  designs?: ProductDesign[];
  priceVaries?: boolean;
  /** Color slug shown when a link names no color or design. */
  defaultColor?: string;
  /** Sold off Shopify; the card links here instead of a product page and can't be quick added. */
  externalUrl?: string;
  /** Published review totals, present only once there are enough that one review can't swing the average. */
  rating?: ListingRating;
  /** Reviews were read and none are published yet; absent when they couldn't be read. */
  unreviewed?: true;
  /** Every published review pooled across the listing's designs, below the rating threshold too; absent when they couldn't be read. */
  reviewCount?: number;
};

export type ListingRating = { average: number; count: number };

export type CollectionSummary = {
  description: string;
  handle: string;
  id: string;
  image: StoreImage | null;
  title: string;
};

/** `grouping` marks a garment grouping on a department page rather than a Shopify collection. */
export type CollectionSection = { collection: CollectionSummary; products: ProductListing[]; total: number; grouping?: boolean };

/** Listings broken up by Shopify collection, with `more` holding those in none. */
export type CatalogSections = { sections: CollectionSection[]; more: ProductListing[] };

export type ProductPage = {
  collection: CollectionSummary;
  products: ProductListing[];
} & Partial<CatalogSections>;

export type CartLine = {
  id: string;
  merchandise: ProductVariant & {
    /** `href` is the canonical product link, resolved on the server; older saved carts lack it. */
    product: Pick<Product, "handle" | "title"> & { tags?: string[]; href?: string };
  };
  quantity: number;
};

export type Cart = {
  checkoutUrl: string;
  /** The buyer's order note, which Shopify carries onto the order. Older saved carts lack it. */
  note?: string | null;
  cost: { subtotalAmount: Money; totalAmount: Money };
  /** Order-level discounts Shopify has applied, such as a sale's automatic discount. Older saved carts lack it. */
  discountAllocations?: { discountedAmount: Money }[];
  id: string;
  lines: CartLine[];
  totalQuantity: number;
};

export type Review = {
  body: string;
  createdAt: string;
  id: string;
  rating: number;
  reviewerName: string;
  /** Null only for a review imported from Etsy, which has no title. */
  title: string | null;
  /** The badge's meaning comes from the public data adapter, never the selected UI mode. */
  verification: "purchase" | "etsy" | null;
  photoUrls?: string[];
  /** Public reply only; staff identity and moderation fields stay on the server. */
  reply?: PublicReviewReply;
};

export type ReviewsData = {
  status: "available";
  averageRating: number;
  count: number;
  reviews: Review[];
  /** Custom public reads only. Later pages are read by this internal numeric product ID, never shown in browser navigation. */
  productId?: string;
} | {
  status: "unavailable";
  averageRating: 0;
  count: 0;
  reviews: [];
};

/** A policy written in Shopify Admin → Settings → Policies. `body` is HTML. */
export type ShopPolicy = {
  body: string;
  handle: string;
  title: string;
};
