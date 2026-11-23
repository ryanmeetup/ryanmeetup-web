import { Heading, Text } from "@ryanmeetup/ui";
import Link from "next/link";
import { FiArrowRight, FiHeart } from "react-icons/fi";

export const SUPPORT_HEADLINE = "Buying merch is the best way to support Ryan Meetup.";
export const SUPPORT_REASON = "We keep our events free or as low cost as we can, charging only when we have to, like for ballgame or festival tickets.";
export const SUPPORT_THANKS = "Your orders help cover the rest. Thank you, Ryans, for your support.";

const linkClassName = "inline-flex items-center gap-1 rounded-sm font-semibold underline decoration-black/30 underline-offset-4 transition hover:decoration-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:decoration-white/30 dark:hover:decoration-white dark:focus-visible:ring-white/40";

/**
 * The store's reason to exist, said right after the home hero: merch is how the meetup is funded.
 * Set as a statement in the display face rather than boxed like a notice, so it reads as the
 * brand talking. Phones keep the headline and About link; the fuller explanation stays on larger
 * screens. From lg the explanation sits beside the headline, aligned to its last line.
 */
export function SupportNote({ className }: { className?: string }) {
  return (
    <div className={`grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-end lg:gap-12 ${className ?? ""}`}>
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <FiHeart aria-hidden className="mt-1 h-7 w-7 shrink-0 fill-current text-nametag sm:h-9 sm:w-9" />
        <Heading size="h2" className="text-balance text-2xl leading-tight sm:text-4xl">
          {SUPPORT_HEADLINE}
        </Heading>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-3 pl-10 sm:pl-[3.25rem] lg:pl-0">
        <Text className="hidden sm:block">{SUPPORT_REASON} {SUPPORT_THANKS}</Text>
        <Link href="/about#money" className={`${linkClassName} text-sm sm:text-base`}>
          Where your money goes
          <FiArrowRight aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/** The same reason, one line long, where shoppers commit to an order. */
export function SupportLine() {
  return (
    <span className="flex items-start gap-2">
      <FiHeart aria-hidden className="mt-0.5 shrink-0 text-nametag" />
      <span>Every order helps fund Ryan Meetup. Thanks for keeping the meetups meeting.</span>
    </span>
  );
}
