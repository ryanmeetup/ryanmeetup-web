import Link from "next/link";
import { cloneElement, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";

export type SocialLink = {
  href: string;
  label: string;
  icon: ReactNode;
  ctaVerb?: string;
};
export type SocialLinkGridProps = {
  links: SocialLink[];
  className?: string;
  columns?: 2 | 3 | 4;
};

const SocialLinkGrid = ({
  links,
  className,
  columns = 3,
}: SocialLinkGridProps) => (
  <div
    className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : columns === 4 ? "grid-cols-4" : "grid-cols-3"} ${className ?? ""}`}
  >
    {links.map((link) => {
      const icon = isValidElement(link.icon)
        ? cloneElement(link.icon as ReactElement<{ className?: string }>, {
            className: `${(link.icon as ReactElement<{ className?: string }>).props.className ?? ""} h-6 w-6 fill-current transition group-hover:scale-105`,
          })
        : link.icon;
      return (
        <Link
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          aria-label={`${link.ctaVerb ?? "Follow"} on ${link.label}`}
          className="group flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-black/10 bg-white/70 px-2 py-3 text-black shadow-sm transition hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/30 dark:hover:bg-white/10"
        >
          {icon}
          <span className="max-w-full truncate text-[10px] font-semibold uppercase tracking-caps-tight">
            {link.label}
          </span>
        </Link>
      );
    })}
  </div>
);

export { SocialLinkGrid };
