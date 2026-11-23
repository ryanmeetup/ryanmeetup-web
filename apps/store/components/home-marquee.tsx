"use client";

import { TextMarquee } from "@ryanmeetup/ui";
import { usePromotion } from "@/components/promotion";
import { buildHomeBand } from "@/lib/home-band";

/**
 * The phone band under the home hero: a regular sale's essentials while it runs, then why to buy,
 * the shop rating, and the shipping headlines. The facts arrive from the server, so the band never
 * claims something the reviews or policies don't say.
 */
export function HomeMarquee({ facts }: { facts: string[] }) {
  return (
    <TextMarquee
      items={buildHomeBand(usePromotion(), facts)}
      separator="✦"
      speed={45}
      className="bg-nametag py-2 text-white sm:py-3"
      itemClassName="font-cooper text-2xl tracking-wider sm:text-3xl motion-reduce:text-lg"
    />
  );
}
