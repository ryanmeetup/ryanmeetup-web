"use client";

import { TextMarquee } from "@ryanmeetup/ui";
import { usePromotion } from "@/components/promotion";
import { buildHomeBand } from "@/lib/home-band";

/**
 * One band under the home hero: a regular sale's essentials while it runs, then the shop rating
 * and shipping headlines with the name between each. The facts arrive from the server, so the
 * band never claims something the reviews or policies don't say.
 */
export function HomeMarquee({ facts }: { facts: string[] }) {
  const { items, spoken } = buildHomeBand(usePromotion(), facts);
  return (
    <TextMarquee
      items={items}
      spokenItems={spoken}
      separator="✦"
      decorative={!spoken.length}
      speed={45}
      className="bg-nametag py-2 text-white sm:py-3"
      itemClassName="font-cooper text-2xl tracking-wider sm:text-3xl"
    />
  );
}
