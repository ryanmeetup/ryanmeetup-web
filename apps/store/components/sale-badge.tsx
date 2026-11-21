"use client";

import { getSitewidePercentOff } from "@/lib/promotion";
import { usePromotion } from "./promotion";

/**
 * Marks a markdown or a sitewide sale in words as well as color, or renders nothing when neither applies.
 * A deeper red than the nametag red keeps small white text readable.
 */
export function SaleBadge({ markedDown = false, promotable = true, className = "" }: { markedDown?: boolean; promotable?: boolean; className?: string }) {
  const promotion = usePromotion();
  const sitewide = promotable && getSitewidePercentOff(promotion) !== null;
  if (!markedDown && !sitewide) return null;
  return <span className={`inline-flex items-center rounded-full bg-red-700 px-3 py-1 text-[10px] font-bold uppercase tracking-caps-tight text-white ${className}`}>Sale</span>;
}
