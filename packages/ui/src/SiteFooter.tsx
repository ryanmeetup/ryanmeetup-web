import Link from "next/link";
import type { ReactNode } from "react";
import { Divider } from "./Divider";
import { Heading } from "./Heading";

export type SiteFooterLink = {
  href: string;
  label: string;
  icon?: ReactNode;
};

export type SiteFooterSection = {
  title: string;
  links: SiteFooterLink[];
  columns?: 1 | 2;
};

export type SiteFooterCredit = {
  href: string;
  label: string;
  prefix?: string;
  suffix?: string;
};

export type SiteFooterProps = {
  title: string;
  /** Optional rendered wordmark. `title` remains the accessible fallback. */
  wordmark?: ReactNode;
  subtitle?: string;
  sections?: SiteFooterSection[];
  socialLinks?: SiteFooterLink[];
  homeHref?: string;
  credit?: SiteFooterCredit;
  className?: string;
  /**
   * `branded` is the marquee shape: an oversized wordmark and subtitle, the
   * link sections, then credit and socials. Everything in it is supplied by
   * the caller, so it is a layout rather than any one organization's footer.
   * `minimal` is the same content at a quieter scale: a small wordmark, the
   * section links flattened into one inline row, socials, and the credit.
   */
  variant?: "branded" | "minimal";
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/30";

/**
 * The credit sentence. Both variants show it, and it is the one line that must
 * survive every layout, so it lives in one place rather than being written out
 * per variant.
 */
function FooterCredit({ credit }: { credit: SiteFooterCredit }) {
  return (
    <span>
      {credit.prefix ?? "Website designed and developed by "}
      <Link
        href={credit.href}
        className={`rounded-sm font-semibold underline decoration-black/30 underline-offset-2 transition hover:decoration-current dark:decoration-white/30 ${focusRing}`}
      >
        {credit.label}
      </Link>
      {credit.suffix ?? ". All Rights Reserved."}
    </span>
  );
}

export function SiteFooter({
  title,
  wordmark,
  subtitle = "",
  sections = [],
  socialLinks = [],
  homeHref = "/",
  credit,
  className = "",
  variant = "branded",
}: SiteFooterProps) {
  if (variant === "minimal") {
    // The same links the branded variant stacks into titled columns, laid out
    // as one inline row. Dropping them entirely was the old behavior and it
    // made the section titles silently meaningless at this size.
    const inlineLinks = sections.flatMap((section) => section.links);

    return (
      <footer
        className={`relative border-t border-black/10 bg-white py-6 text-sm text-black/70 dark:border-white/10 dark:bg-black/80 dark:text-white/70 ${className}`}
      >
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <Link
              href={homeHref}
              className={`rounded-sm font-cooper text-lg uppercase leading-none tracking-wide text-black dark:text-white ${focusRing}`}
            >
              {wordmark ?? title}
            </Link>
            {subtitle && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em]">
                {subtitle}
              </p>
            )}
          </div>

          {inlineLinks.length > 0 && (
            <nav aria-label="Footer">
              <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-medium sm:justify-start">
                {inlineLinks.map((link) => (
                  <li key={`${link.href}-${link.label}`}>
                    <Link
                      href={link.href}
                      className={`rounded-sm hover:underline ${focusRing}`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {socialLinks.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-1">
              {socialLinks.map((link) => (
                <li key={`${link.href}-${link.label}`}>
                  <Link
                    href={link.href}
                    aria-label={link.label}
                    className={`inline-flex rounded-full p-2 transition hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white ${focusRing}`}
                  >
                    {link.icon ?? link.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {credit && (
          <p className="mt-5 border-t border-black/10 pt-4 text-center text-xs sm:text-left dark:border-white/10">
            <FooterCredit credit={credit} />
          </p>
        )}
      </footer>
    );
  }

  return (
    <footer
      className={`relative border-t border-black/10 bg-white py-10 dark:border-white/10 dark:bg-black/80 ${className}`}
    >
      <div
        className={`grid gap-10 ${sections.length > 0 ? "xl:grid-cols-[1.2fr_1fr]" : ""}`}
      >
        <div className="space-y-4 text-center">
          <Link
            href={homeHref}
            className={`flex flex-col items-center gap-1 rounded-sm ${focusRing}`}
          >
            <Heading
              className="title text-4xl sm:text-5xl md:text-6xl"
              size="h2"
            >
              {wordmark ?? title}
            </Heading>
            {subtitle && (
              <p className="title mt-[2px] text-center font-cooper text-xl uppercase sm:text-2xl md:text-3xl">
                {subtitle}
              </p>
            )}
          </Link>
        </div>

        {/* Balanced columns rather than a grid, so a short section stacks under
            a neighbour instead of sharing a row with a tall one and leaving a
            hole beneath it. */}
        <div
          className={`space-y-8 ${sections.length > 1 ? "sm:columns-2 sm:gap-8" : ""} ${sections.length === 0 ? "hidden" : ""}`}
        >
          {sections.map((section) => (
            <section
              className="break-inside-avoid"
              key={section.title}
              aria-labelledby={`footer-${section.title.toLowerCase().replaceAll(" ", "-")}`}
            >
              <h2
                id={`footer-${section.title.toLowerCase().replaceAll(" ", "-")}`}
                className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-black/70 dark:text-white/70"
              >
                {section.title}
              </h2>
              <ul
                className={`grid gap-x-4 gap-y-2 text-sm font-medium text-black/70 dark:text-white/70 ${section.columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}
              >
                {section.links.map((link) => (
                  <li key={`${link.href}-${link.label}`}>
                    <Link
                      href={link.href}
                      className={`rounded-sm hover:underline ${focusRing}`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <Divider margins="lg" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {credit && (
          <span className="text-sm text-black/70 dark:text-white/70 sm:text-center">
            <FooterCredit credit={credit} />
          </span>
        )}

        {socialLinks.length > 0 && (
          <ul className="flex flex-wrap gap-6">
            {socialLinks.map((link) => (
              <li key={`${link.href}-${link.label}`}>
                <Link
                  href={link.href}
                  aria-label={link.label}
                  className={`inline-flex rounded-sm ${focusRing}`}
                >
                  {link.icon ?? link.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  );
}
