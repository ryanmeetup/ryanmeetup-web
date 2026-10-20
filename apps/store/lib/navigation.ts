import { createElement } from "react";
import { FiInfo, FiMail, FiTag } from "react-icons/fi";
import { FaBoxesStacked, FaShirt, FaStore } from "react-icons/fa6";

export const StoreHomeIcon = FaStore;
export const StoreCollectionIcon = FaBoxesStacked;
export const StoreProductIcon = FiTag;

export const storeNavigation = [
  {
    href: "/collections/all",
    label: "Shop all",
    description: "Browse every Ryan-approved provision.",
    icon: FaBoxesStacked,
  },
  {
    href: "/collections/apparel",
    label: "Apparel",
    description: "Shirts, sweatshirts, and wearable Ryan pride.",
    icon: FaShirt,
  },
  {
    href: "/collections/accessories",
    label: "Accessories",
    description: "The finishing touches for a fully equipped Ryan.",
    icon: FiTag,
  },
  {
    href: "/about",
    label: "About",
    description: "Who makes the goods and where the money goes.",
    icon: FiInfo,
  },
  {
    href: "/contact",
    label: "Contact",
    description: "Get help with an order or product.",
    icon: FiMail,
  },
] as const;

export function getStoreCollectionIcon(handle: string) {
  const Icon =
    handle === "apparel"
      ? FaShirt
      : handle === "accessories"
        ? FiTag
        : FaBoxesStacked;

  return createElement(Icon, { "aria-hidden": true, className: "shrink-0" });
}
