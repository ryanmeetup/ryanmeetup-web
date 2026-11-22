import Link from "next/link";
import { FiArrowRight, FiHeart } from "react-icons/fi";

export const SUPPORT_HEADLINE = "Buying merch is the best way to support Ryan Meetup.";

const linkClassName = "inline-flex items-center gap-1 rounded-sm font-semibold underline decoration-black/30 underline-offset-4 transition hover:decoration-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:decoration-white/30 dark:hover:decoration-white dark:focus-visible:ring-white/40";

/**
 * The store's reason to exist, said beside the home page's main call to action:
 * merch is how the meetup is funded. The heart takes the name-tag red so it reads
 * as the brand speaking rather than a sale.
 */
export function SupportNote({ className }: { className?: string }) {
  return (
    <p className={`flex items-start gap-2 text-sm text-black/80 sm:text-base dark:text-white/80 ${className ?? ""}`}>
      <FiHeart aria-hidden className="mt-0.5 shrink-0 text-nametag sm:mt-1" />
      <span>
        <strong className="font-semibold text-black dark:text-white">{SUPPORT_HEADLINE}</strong>{" "}
        <Link href="/about#money" className={linkClassName}>
          Where your money goes
          <FiArrowRight aria-hidden />
        </Link>
      </span>
    </p>
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
