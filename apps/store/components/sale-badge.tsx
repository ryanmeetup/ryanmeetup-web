"use client";

import { getSitewidePercentOff } from "@/lib/promotion";
import { usePromotion } from "./promotion";

// A 16-point starburst in a 100×100 box, the shape of a price-gun sale sticker.
const spikes = 16;
const starburst = Array.from({ length: spikes * 2 }, (_, index) => {
  const radius = index % 2 ? 41 : 48;
  const angle = (Math.PI * index) / spikes;
  return `${(50 + radius * Math.sin(angle)).toFixed(2)},${(50 - radius * Math.cos(angle)).toFixed(2)}`;
}).join(" ");

const sizeClasses = {
  sm: "size-11 text-xs",
  md: "size-12 text-sm sm:size-16 sm:text-base",
  lg: "size-20 text-lg",
};

export type SaleBadgeProps = {
  markedDown?: boolean;
  promotable?: boolean;
  size?: keyof typeof sizeClasses;
  className?: string;
};

/**
 * Marks a markdown or a sitewide sale in words as well as color, or renders nothing when neither applies.
 * A deeper red than the nametag red keeps the white lettering readable.
 */
export function SaleBadge({ markedDown = false, promotable = true, size = "md", className = "" }: SaleBadgeProps) {
  const promotion = usePromotion();
  const sitewide = promotable && getSitewidePercentOff(promotion) !== null;
  if (!markedDown && !sitewide) return null;
  return (
    <span className={`inline-grid shrink-0 -rotate-12 place-items-center drop-shadow-md ${sizeClasses[size]} ${className}`}>
      <svg aria-hidden viewBox="0 0 100 100" className="col-start-1 row-start-1 size-full overflow-visible">
        <polygon points={starburst} strokeLinejoin="round" className="fill-red-700 stroke-white [stroke-width:4]" />
      </svg>
      <span className="col-start-1 row-start-1 font-cooper leading-none tracking-wide text-white">Sale</span>
    </span>
  );
}
