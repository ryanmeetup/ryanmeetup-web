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

export type Product = {
  availableForSale: boolean;
  description: string;
  descriptionHtml: string;
  featuredImage: StoreImage | null;
  handle: string;
  id: string;
  images: StoreImage[];
  options: ProductOption[];
  priceRange: { minVariantPrice: Money };
  productType: string;
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
};

export type CollectionSummary = {
  description: string;
  handle: string;
  id: string;
  image: StoreImage | null;
  title: string;
};

export type CollectionSection = { collection: CollectionSummary; products: ProductListing[]; total: number };

/** Listings broken up by Shopify collection, with `more` holding those in none. */
export type CatalogSections = { sections: CollectionSection[]; more: ProductListing[] };

export type ProductPage = {
  collection: CollectionSummary;
  products: ProductListing[];
} & Partial<CatalogSections>;

export type CartLine = {
  id: string;
  merchandise: ProductVariant & {
    product: Pick<Product, "handle" | "title"> & { tags?: string[] };
  };
  quantity: number;
};

export type Cart = {
  checkoutUrl: string;
  cost: { subtotalAmount: Money; totalAmount: Money };
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
  title: string;
  verified: boolean;
};

export type ReviewsData = {
  averageRating: number;
  count: number;
  reviews: Review[];
};
