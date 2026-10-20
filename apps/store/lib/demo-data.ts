import type { CollectionSummary, Product } from "./types";

const image = (url: string, altText: string) => ({
  url,
  altText,
  width: 1200,
  height: 1500,
});

const makeProduct = (input: {
  handle: string;
  title: string;
  description: string;
  price: string;
  imageUrl: string;
  color: string;
  type: string;
  tags?: string[];
}): Product => {
  const productImage = image(input.imageUrl, input.title);
  const sizes = input.type === "Accessories" ? ["One size"] : ["S", "M", "L", "XL", "2XL"];
  return {
    id: `gid://shopify/Product/demo-${input.handle}`,
    handle: input.handle,
    title: input.title,
    description: input.description,
    descriptionHtml: `<p>${input.description}</p>`,
    availableForSale: true,
    featuredImage: productImage,
    images: [productImage],
    options: [
      { id: `${input.handle}-size`, name: "Size", values: sizes },
      { id: `${input.handle}-color`, name: "Color", values: [input.color] },
    ],
    priceRange: { minVariantPrice: { amount: input.price, currencyCode: "USD" } },
    productType: input.type,
    tags: [input.type.toLowerCase(), input.color.toLowerCase(), ...(input.tags ?? [])],
    variants: sizes.map((size, index) => ({
      id: `gid://shopify/ProductVariant/demo-${input.handle}-${index}`,
      title: `${size} / ${input.color}`,
      availableForSale: size !== "2XL" || input.handle !== "ryan-meetup-tee",
      image: productImage,
      price: { amount: input.price, currencyCode: "USD" },
      selectedOptions: [
        { name: "Size", value: size },
        { name: "Color", value: input.color },
      ],
    })),
  };
};

export const demoProducts: Product[] = [
  makeProduct({
    handle: "ryan-meetup-tee",
    title: "Official Ryan Meetup Tee",
    description: "The uniform for meeting a suspiciously large number of people with your name.",
    price: "29.00",
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=85",
    color: "Black",
    type: "Shirts",
  }),
  makeProduct({
    handle: "hello-my-name-is-ryan-sweatshirt",
    title: "Hello, My Name Is Ryan Sweatshirt",
    description: "Warm, comfortable, and a decisive end to the introductions portion of the evening.",
    price: "54.00",
    imageUrl: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=1200&q=85",
    color: "Cream",
    type: "Sweatshirts",
  }),
  makeProduct({
    handle: "ryan-society-cap",
    title: "Ryan Society Cap",
    description: "A low-profile cap for high-profile Ryans and their approved non-Ryan guests.",
    price: "26.00",
    imageUrl: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1200&q=85",
    color: "Navy",
    type: "Accessories",
  }),
  makeProduct({
    handle: "certified-ryan-tote",
    title: "Certified Ryan Pack",
    description: "Carries snacks, name tags, and the burden of being named Ryan with equal ease.",
    price: "24.00",
    imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=85",
    color: "Natural",
    type: "Accessories",
  }),
  makeProduct({
    handle: "ryan-name-tag-shirt",
    title: "Ryan Name Tag shirt",
    description: "The classic Ryan introduction, printed on a shirt.",
    price: "12.00",
    imageUrl: "https://cdn.shopify.com/s/files/1/0718/7005/4511/files/unisex-classic-tee-white-front-6acd5a66edb8c.jpg?v=1791842937",
    color: "White",
    type: "Shirts",
    tags: ["name tag"],
  }),
  makeProduct({
    handle: "ryans-dad-name-tag-shirt",
    title: "Ryan's Dad Name Tag shirt",
    description: "A nametag shirt for Ryan’s dad.",
    price: "30.00",
    imageUrl: "https://cdn.shopify.com/s/files/1/0718/7005/4511/files/unisex-classic-tee-white-front-6acd5bf343e98.jpg?v=1791843327",
    color: "Natural",
    type: "Shirts",
    tags: ["name tag"],
  }),
];

export const demoCollections: CollectionSummary[] = [
  {
    id: "gid://shopify/Collection/demo-all",
    handle: "all",
    title: "All Ryan Goods",
    description: "Official issue for Ryans, friends of Ryans, and the Ryan-curious.",
    image: demoProducts[0].featuredImage,
  },
  {
    id: "gid://shopify/Collection/demo-apparel",
    handle: "apparel",
    title: "Apparel",
    description: "Wear your first name on your sleeve. Sometimes literally.",
    image: demoProducts[1].featuredImage,
  },
  {
    id: "gid://shopify/Collection/demo-accessories",
    handle: "accessories",
    title: "Accessories",
    description: "Useful objects with excellent name recognition.",
    image: demoProducts[2].featuredImage,
  },
];
