import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@ryanmeetup/ui";
import { FiArrowRight } from "react-icons/fi";

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

export function MetricLinkCard({
  detail,
  href,
  icon,
  label,
  mobileLabel = label,
  tone,
  value,
}: {
  detail?: ReactNode;
  href?: string;
  icon: ReactNode;
  label: string;
  mobileLabel?: string;
  tone: keyof typeof toneClasses;
  value: ReactNode;
}) {
  const card = (
    <Card
      size="none"
      className={`relative h-full min-h-24 overflow-hidden p-3 sm:min-h-32 sm:p-4 ${
        href
          ? "cursor-pointer transition duration-200 group-hover:-translate-y-1 group-hover:shadow-lg motion-reduce:transform-none"
          : ""
      } ${toneClasses[tone]}`}
    >
      <span className="flex items-center gap-1.5 whitespace-nowrap text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-black/50 dark:text-white/50 sm:gap-2 sm:text-xs sm:tracking-[0.16em]">
        {icon}
        <span className="sm:hidden">{mobileLabel}</span>
        <span className="hidden sm:inline">{label}</span>
      </span>
      <div className="relative z-10 mt-4 flex items-end justify-between gap-2 sm:mt-5">
        <p className="font-cooper text-3xl leading-none sm:text-5xl">{value}</p>
        {href && (
          <FiArrowRight
            aria-hidden
            data-metric-link-arrow
            className="mb-0.5 shrink-0 text-sm text-black/35 transition group-hover:translate-x-1 group-hover:text-black/70 motion-reduce:transform-none dark:text-white/35 dark:group-hover:text-white/75 sm:mb-1 sm:text-base"
          />
        )}
      </div>
      {detail && (
        <p className="mt-1 text-xs font-medium text-black/50 dark:text-white/50">
          {detail}
        </p>
      )}
      <span
        aria-hidden
        className={`absolute -bottom-3 -right-2 text-[3.75rem] opacity-[0.045] dark:opacity-[0.06] sm:-bottom-7 sm:-right-5 sm:text-[6rem] ${
          href
            ? "transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110"
            : ""
        }`}
      >
        {icon}
      </span>
    </Card>
  );

  if (!href) return card;

  return (
    <Link
      href={href}
      aria-label={`View ${label.toLowerCase()}`}
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f1f2ef] dark:focus-visible:ring-white/50 dark:focus-visible:ring-offset-[#101010]"
    >
      {card}
    </Link>
  );
}
