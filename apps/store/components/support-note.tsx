import Link from "next/link";
import { FiArrowRight, FiHeart } from "react-icons/fi";

export const SUPPORT_HEADLINE = "Buying merch is the best way to support Ryan Meetup.";

const linkClassName = "inline-flex items-center gap-1 rounded-sm font-semibold underline decoration-black/30 underline-offset-4 transition hover:decoration-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:decoration-white/30 dark:hover:decoration-white dark:focus-visible:ring-white/40";

/**
 * The store's reason to exist, said first on the home page: merch is how the meetup is funded.
 * Tinted with the name-tag red so it reads as the brand speaking rather than a sale.
 */
export function SupportNote({ className }: { className?: string }) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border border-nametag/25 bg-nametag/5 p-4 sm:items-center sm:gap-4 sm:p-5 dark:border-nametag/40 dark:bg-nametag/10 ${className ?? ""}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-nametag/10 text-lg text-nametag dark:bg-nametag/20">
        <FiHeart aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:gap-6">
        <div className="min-w-0 flex-1 text-black/80 dark:text-white/80">
          <p className="text-base font-semibold text-black sm:text-lg dark:text-white">{SUPPORT_HEADLINE}</p>
          <p className="mt-1 text-sm sm:text-base">
            Every order helps fund the events, activities, and organization behind the meetup. Wear the shirt, fund the next gathering.
          </p>
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
