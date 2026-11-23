import Link from "next/link";
import { FiArrowRight, FiHeart } from "react-icons/fi";

export const SUPPORT_HEADLINE = "Buying merch is the best way to support Ryan Meetup.";
export const SUPPORT_REASON = "We keep our events free or as low cost as we can, charging only when we have to, like for ballgame or festival tickets.";
export const SUPPORT_THANKS = "Your orders help cover the rest. Thank you, Ryans, for your support.";

const linkClassName = "inline-flex items-center gap-1 rounded-sm font-semibold underline decoration-black/30 underline-offset-4 transition hover:decoration-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:decoration-white/30 dark:hover:decoration-white dark:focus-visible:ring-white/40";

/**
 * The store's reason to exist, said right after the home hero: merch is how the meetup is funded.
 * Phones keep the headline and About link; the fuller explanation stays on larger screens.
 * Tinted with the name-tag red so it reads as the brand speaking rather than a sale.
 */
export function SupportNote({ className }: { className?: string }) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border border-nametag/25 bg-nametag/5 p-4 sm:items-center sm:gap-4 sm:p-5 dark:border-nametag/40 dark:bg-nametag/10 ${className ?? ""}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nametag/10 text-lg text-nametag sm:h-10 sm:w-10 dark:bg-nametag/20">
        <FiHeart aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:gap-3 md:flex-row md:items-center md:gap-6">
        <div className="min-w-0 flex-1 text-black/80 dark:text-white/80">
          <p className="text-sm font-semibold text-black sm:text-lg dark:text-white">{SUPPORT_HEADLINE}</p>
          <p className="mt-1 hidden sm:block sm:text-base">{SUPPORT_REASON}</p>
          <p className="mt-1 hidden sm:block sm:text-base">{SUPPORT_THANKS}</p>
        </div>
        <Link href="/about#money" className={`${linkClassName} self-start text-sm md:self-center md:whitespace-nowrap`}>
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
