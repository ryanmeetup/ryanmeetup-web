import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@ryanmeetup/ui";
import { FiArrowRight, FiCheck } from "react-icons/fi";

const toneClasses = {
  amber:
    "border-amber-400/75! bg-amber-50! dark:border-amber-300/60! dark:bg-amber-400/15!",
  blue: "border-blue-400/70! bg-blue-50! dark:border-blue-300/55! dark:bg-blue-400/15!",
  green:
    "border-emerald-400/70! bg-emerald-50! dark:border-emerald-300/55! dark:bg-emerald-400/15!",
  red: "border-red-400/70! bg-red-50! dark:border-red-300/55! dark:bg-red-400/15!",
  violet:
    "border-violet-400/70! bg-violet-50! dark:border-violet-300/55! dark:bg-violet-400/15!",
};

const focusRing =
  "group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f1f2ef] dark:focus-visible:ring-white/50 dark:focus-visible:ring-offset-[#101010]";

/**
 * A tinted metric. With `href` it navigates; with `onClick` it toggles a
 * filter, and `active` marks it pressed with a ring and a check.
 */
export function MetricLinkCard({
  active = false,
  detail,
  href,
  icon,
  label,
  mobileLabel = label,
  onClick,
  tone,
  value,
}: {
  active?: boolean;
  detail?: ReactNode;
  href?: string;
  icon: ReactNode;
  label: string;
  mobileLabel?: string;
  onClick?: () => void;
  tone: keyof typeof toneClasses;
  value: ReactNode;
}) {
  const interactive = Boolean(href || onClick);
  const card = (
    <Card
      size="none"
      className={`relative h-full min-h-24 overflow-hidden px-2 py-3 sm:min-h-32 sm:p-4 ${
        interactive
          ? "cursor-pointer transition duration-200 group-hover:-translate-y-1 group-hover:shadow-lg motion-reduce:transform-none"
          : ""
      } ${active ? "ring-2 ring-black/70 dark:ring-white/75" : ""} ${toneClasses[tone]}`}
    >
      <span className="relative z-10 flex items-center gap-1 whitespace-nowrap text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-black/50 dark:text-white/50 sm:gap-2 sm:text-xs sm:tracking-[0.16em]">
        <span className="shrink-0">{icon}</span>
        <span className="shrink-0 md:hidden">{mobileLabel}</span>
        <span className="hidden shrink-0 md:inline">{label}</span>
        {href && (
          <FiArrowRight
            aria-hidden
            data-metric-link-arrow
            className="ml-auto shrink-0 text-sm text-black/35 transition group-hover:translate-x-1 group-hover:text-black/70 motion-reduce:transform-none dark:text-white/35 dark:group-hover:text-white/75 sm:text-base"
          />
        )}
        {active && (
          <FiCheck
            aria-hidden
            className="ml-auto shrink-0 text-sm text-black/70 dark:text-white/75 sm:text-base"
          />
        )}
      </span>
      <p className="relative z-10 mt-4 font-cooper text-3xl leading-none sm:mt-5 sm:text-5xl">
        {value}
      </p>
      {detail && (
        <p className="mt-1 text-xs font-medium text-black/50 dark:text-white/50">
          {detail}
        </p>
      )}
      <span
        aria-hidden
        className={`absolute -bottom-3 -right-2 text-[3.75rem] opacity-[0.045] dark:opacity-[0.06] sm:-bottom-7 sm:-right-5 sm:text-[6rem] ${
          interactive
            ? "transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110"
            : ""
        }`}
      >
        {icon}
      </span>
    </Card>
  );

  if (onClick)
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={`${focusRing} w-full text-left`}
      >
        {card}
      </button>
    );

  if (!href) return card;

  return (
    <Link
      href={href}
      aria-label={`View ${label.toLowerCase()}`}
      className={focusRing}
    >
      {card}
    </Link>
  );
}
