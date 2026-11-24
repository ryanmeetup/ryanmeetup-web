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
 * Text tints for card labels, each readable on the card in both themes. Top rated's
 * filled star matches the rating stars beneath it.
 */
const labelTones: Record<ListingHighlight, { text: string; icon: string }> = {
  "best-seller": { text: "text-amber-700 dark:text-amber-300", icon: "" },
  trending: { text: "text-emerald-700 dark:text-emerald-300", icon: "" },
  hot: { text: "text-orange-700 dark:text-orange-300", icon: "" },
  "top-rated": { text: "text-amber-700 dark:text-amber-300", icon: "fill-amber-400 text-amber-400" },
  new: { text: "text-sky-700 dark:text-sky-300", icon: "" },
};

/**
 * The same label as tinted text for a card body, where a black chip would compete with
 * the photo's own overlays. Worded as well as tinted, so color is never the only signal.
 * Read-only, so uppercase like any metadata label.
 */
export function HighlightLabel({ highlight, className = "" }: { highlight: ListingHighlight; className?: string }) {
  const Icon = icons[highlight];
  const tone = labelTones[highlight];
  return (
    <p className={`flex items-center gap-1 text-[10px] font-bold uppercase leading-none tracking-caps-tight sm:text-xs ${tone.text} ${className}`}>
      <Icon aria-hidden className={`size-3 shrink-0 sm:size-3.5 ${tone.icon}`} />
      {highlightLabels[highlight]}
    </p>
  );
}
