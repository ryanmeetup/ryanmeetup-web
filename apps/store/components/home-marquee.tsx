"use client";

import { TextMarquee } from "@ryanmeetup/ui";
import { usePromotion } from "@/components/promotion";

/**
 * One band under the home hero. While a sale runs it says only the three things worth a
 * glance (its name, the best discount, the last day); the banner above carries the details.
 * Otherwise it is just the name on a loop.
 */
export function HomeMarquee() {
  const promotion = usePromotion();
  const bestOff = promotion ? Math.max(...promotion.tiers.map(({ percentOff }) => percentOff)) : 0;
  return (
    <TextMarquee
      items={promotion ? [promotion.name, `Up to ${bestOff}% off`, `Ends ${promotion.endsLabel}`] : ["Ryan"]}
      separator="✦"
      decorative={!promotion}
      speed={45}
      className="bg-nametag py-2 text-white sm:py-3"
      itemClassName="font-cooper text-2xl tracking-wider sm:text-3xl"
    />
  );
}
