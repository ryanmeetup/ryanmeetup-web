import type { IconType } from "react-icons";
import { FiAward, FiPlus, FiStar, FiTrendingUp, FiZap } from "react-icons/fi";
import { highlightLabels, type ListingHighlight } from "@/lib/listing-highlights";

const icons: Record<ListingHighlight, IconType> = {
  "best-seller": FiAward,
  trending: FiTrendingUp,
  hot: FiZap,
  "top-rated": FiStar,
  new: FiPlus,
};

const sizeClasses = {
  // Cards sit two-up on phones, so the chip stays small until there is room.
  sm: "gap-1 px-2 py-1 text-[10px] sm:px-2.5 [&>svg]:size-3",
  md: "gap-1.5 px-3 py-1.5 text-xs [&>svg]:size-3.5",
};

/**
 * An earned listing label, such as "Best seller", worded as well as iconed. Black in both
 * themes, like the "Sold out" chip, since it sits on product photos rather than the page.
 */
export function HighlightChip({ highlight, size = "sm", className = "" }: { highlight: ListingHighlight; size?: keyof typeof sizeClasses; className?: string }) {
  const Icon = icons[highlight];
  return (
    <span className={`inline-flex w-fit items-center rounded-full bg-black font-bold uppercase leading-none tracking-caps-tight text-white shadow-sm ring-1 ring-white/20 ${sizeClasses[size]} ${className}`}>
      <Icon aria-hidden className="shrink-0" />
      {highlightLabels[highlight]}
    </span>
  );
}

/**
 * The same label as quiet text for a card body, where a black chip would compete with the
 * photo's own overlays. Read-only, so uppercase like any metadata label.
 */
export function HighlightLabel({ highlight, className = "" }: { highlight: ListingHighlight; className?: string }) {
  const Icon = icons[highlight];
  return (
    <p className={`flex items-center gap-1 text-[10px] font-bold uppercase leading-none tracking-caps-tight text-black/70 sm:text-xs dark:text-white/70 ${className}`}>
      <Icon aria-hidden className="size-3 shrink-0 sm:size-3.5" />
      {highlightLabels[highlight]}
    </p>
  );
}
