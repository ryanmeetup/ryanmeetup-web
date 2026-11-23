"use client";

import { TextMarquee } from "@ryanmeetup/ui";
import { usePromotion } from "@/components/promotion";
import { describeTiers } from "@/lib/promotion";

// One is enough: the band repeats its run until it fills the width.
const NAME_RUN = ["Ryan"];

/**
 * Two straight bands under the home hero: the name on a loop, then what a shopper should know,
 * led by the running sale while it lasts. The facts arrive from the server (production time,
 * where it ships), so the band never claims something the policies don't say.
 */
export function HomeMarquee({ facts }: { facts: string[] }) {
  const promotion = usePromotion();
  const offer = promotion
    ? [`${promotion.name}: ${describeTiers(promotion.tiers)}`, `Ends ${promotion.endsLabel}`]
    : [];
  const items = [...offer, ...facts];
  return (
    <div>
      <TextMarquee
        items={NAME_RUN}
        separator="✦"
        decorative
        speed={45}
        className="bg-nametag py-2 text-white sm:py-3"
        itemClassName="font-cooper text-2xl tracking-wider sm:text-3xl"
      />
      {items.length > 0 && (
        <TextMarquee
          items={items}
          separator="/"
          direction="right"
          speed={35}
          className="bg-white py-2.5 text-black sm:py-3"
          itemClassName="text-sm font-semibold sm:text-base"
        />
      )}
    </div>
  );
}
