"use client";

import { useEffect, useMemo, useState } from "react";

// Componenets
import NextLink from "next/link";
import { Heading, Text } from "@ryanmeetup/ui";
import { useCampaignActive } from "@/components/global/useCampaignActive";

// Utilities
import { usePathname } from "next/navigation";

// Types
import type { ReactNode } from "react";

type FloatingCtaTheme = {
  panel?: string;
  border?: string;
  text?: string;
  subtext?: string;
  detailIcon?: string;
  iconPanel?: string;
  iconText?: string;
  dismissPanel?: string;
  glow?: string;
  halo?: string;
  focusRing?: string;
};

type FloatingCtaProps = {
  id: string;
  href: string;
  label: string;
  sublabel?: string;
  secondarySublabel?: string;
  details?: {
    title: string;
    href?: string;
    rows: {
      icon?: ReactNode;
      text: string;
    }[];
  }[];
  icon?: ReactNode;
  hiddenRoutes?: string[];
  dismissDurationMs?: number;
  ariaLabel?: string;
  positionClassName?: string;
  theme?: FloatingCtaTheme;
  className?: string;
  expiresAt?: string;
};

const defaultTheme: Required<FloatingCtaTheme> = {
  panel: "bg-[#0f2741]",
  border: "border-[#d31145] hover:border-[#d31145]",
  text: "text-[#edf3f0]",
  subtext: "text-white dark:text-[#d31145]/90",
  detailIcon: "text-[#d31145]",
  iconPanel: "bg-[#0f2741]",
  iconText: "text-[#d31145]",
  dismissPanel:
    "border-[#d31145] bg-[#0f2741] text-[#edf3f0] hover:border-[#d31145]",
  glow: "bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.2),_transparent_60%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent_60%)]",
  halo: "bg-[conic-gradient(from_180deg,_rgba(0,0,0,0.35),_rgba(0,0,0,0.05),_rgba(0,0,0,0.35))] dark:bg-[conic-gradient(from_180deg,_rgba(255,255,255,0.35),_rgba(255,255,255,0.05),_rgba(255,255,255,0.35))]",
  focusRing: "focus-visible:ring-[#d31145]/70",
};

const FloatingCta = (props: FloatingCtaProps) => {
  const {
    id,
    href,
    label,
    sublabel,
    secondarySublabel,
    details,
    icon,
    hiddenRoutes = [],
    dismissDurationMs = 1000 * 60 * 60 * 24 * 7,
    ariaLabel = label,
    positionClassName = "bottom-[max(1.5rem,env(safe-area-inset-bottom))]",
    theme,
    className,
    expiresAt,
  } = props;

  const resolvedTheme = { ...defaultTheme, ...theme };
  const isCampaignActive = useCampaignActive(expiresAt);
  const pathname = usePathname();
  const dismissKey = useMemo(() => `floatingCtaDismissedAt:${id}`, [id]);
  const [isVisible, setIsVisible] = useState(false);
  const hasDetailLinks = details?.some((detail) => detail.href) ?? false;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(dismissKey);
      const dismissedAt = stored ? Number(stored) : 0;
      if (dismissedAt && Date.now() - dismissedAt < dismissDurationMs) {
        setIsVisible(false);
      } else {
        if (dismissedAt) {
          window.localStorage.removeItem(dismissKey);
        }
        setIsVisible(true);
      }
    } catch {
      setIsVisible(true);
    }
  }, [dismissDurationMs, dismissKey]);

  if (!isCampaignActive || !isVisible || hiddenRoutes.includes(pathname)) {
    return null;
  }

  return (
    <div
      className={`fixed ${positionClassName} right-6 z-[9999] pointer-events-auto ${className ?? ""}`}
    >
      <div className="group relative">
        {hasDetailLinks ? (
          <div aria-label={ariaLabel}>
            <div className="relative">
              <div
                className={`absolute -inset-2 rounded-3xl opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100 ${resolvedTheme.glow}`}
              />
              <div
                className={`absolute -inset-1 rounded-3xl opacity-40 blur-md ${resolvedTheme.halo}`}
              />
              <div
                className={`relative inline-flex min-h-[78px] w-[18.75rem] items-start gap-3 rounded-2xl border px-3 py-3 shadow-[0_12px_30px_-25px_rgba(0,0,0,0.65)] transition group-hover:-translate-y-1 hover:-translate-y-1 sm:min-h-[92px] sm:w-fit sm:max-w-[calc(100vw-3rem)] sm:gap-4 sm:px-5 sm:py-4 sm:shadow-[0_25px_60px_-35px_rgba(0,0,0,0.65)] ${resolvedTheme.panel} ${resolvedTheme.border} ${resolvedTheme.text}`}
              >
                {icon && (
                  <NextLink
                    href={href}
                    className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-md transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 sm:h-11 sm:w-11 ${resolvedTheme.iconPanel} ${resolvedTheme.iconText} ${resolvedTheme.focusRing}`}
                    aria-label={label}
                  >
                    {icon}
                  </NextLink>
                )}
                <div className="min-w-0 flex-1">
                  <NextLink
                    href={href}
                    className={`inline-block focus-visible:outline-none focus-visible:ring-2 ${resolvedTheme.focusRing}`}
                  >
                    <Heading
                      className={`text-lg sm:text-2xl ${resolvedTheme.text}`}
                      size="h4"
                    >
                      {label}
                    </Heading>
                  </NextLink>
                  {details && details.length > 0 ? (
                    <div className="mt-1.5 grid gap-4 sm:max-w-[42rem] sm:grid-cols-[repeat(3,max-content)] sm:gap-8">
                      {details.map((detail) => {
                        const content = (
                          <>
                            <p
                              className={`whitespace-nowrap text-sm font-semibold uppercase leading-tight tracking-wide ${resolvedTheme.subtext}`}
                            >
                              {detail.title}
                            </p>
                            <div className="mt-auto space-y-1 pt-1">
                              {detail.rows.map((row) => (
                                <div
                                  key={`${detail.title}-${row.text}`}
                                  className="flex min-w-0 items-center gap-1.5"
                                >
                                  {row.icon && (
                                    <span
                                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center ${resolvedTheme.detailIcon}`}
                                    >
                                      {row.icon}
                                    </span>
                                  )}
                                  <p
                                    className={`truncate text-xs uppercase leading-tight tracking-wide sm:text-xs ${resolvedTheme.subtext}`}
                                  >
                                    {row.text}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </>
                        );

                        return detail.href ? (
                          <NextLink
                            key={detail.title}
                            href={detail.href}
                            className={`flex min-w-0 flex-col rounded-lg p-1 -m-1 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 ${resolvedTheme.focusRing}`}
                          >
                            {content}
                          </NextLink>
                        ) : (
                          <div
                            key={detail.title}
                            className="flex min-w-0 flex-col"
                          >
                            {content}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    (sublabel || secondarySublabel) && (
                      <div className="space-y-0.5">
                        {sublabel && (
                          <Text
                            className={`text-xs md:text-sm uppercase ${resolvedTheme.subtext}`}
                          >
                            {sublabel}
                          </Text>
                        )}
                        {secondarySublabel && (
                          <Text
                            className={`text-xs uppercase sm:whitespace-nowrap md:text-sm ${resolvedTheme.subtext}`}
                          >
                            {secondarySublabel}
                          </Text>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <NextLink href={href} aria-label={ariaLabel}>
            <div className="relative">
              <div
                className={`absolute -inset-2 rounded-3xl opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100 ${resolvedTheme.glow}`}
              />
              <div
                className={`absolute -inset-1 rounded-3xl opacity-40 blur-md ${resolvedTheme.halo}`}
              />
              <div
                className={`relative inline-flex min-h-[78px] w-[18.75rem] items-start gap-3 rounded-2xl border px-3 py-3 shadow-[0_12px_30px_-25px_rgba(0,0,0,0.65)] transition group-hover:-translate-y-1 hover:-translate-y-1 sm:min-h-[92px] sm:w-fit sm:max-w-[calc(100vw-3rem)] sm:gap-4 sm:px-5 sm:py-4 sm:shadow-[0_25px_60px_-35px_rgba(0,0,0,0.65)] ${resolvedTheme.panel} ${resolvedTheme.border} ${resolvedTheme.text}`}
              >
                {icon && (
                  <div
                    className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-md sm:h-11 sm:w-11 ${resolvedTheme.iconPanel} ${resolvedTheme.iconText}`}
                  >
                    {icon}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <Heading
                    className={`text-lg sm:text-2xl ${resolvedTheme.text}`}
                    size="h4"
                  >
                    {label}
                  </Heading>
                  {details && details.length > 0 ? (
                    <div className="mt-1.5 grid gap-4 sm:max-w-[42rem] sm:grid-cols-[repeat(3,max-content)] sm:gap-8">
                      {details.map((detail) => (
                        <div
                          key={detail.title}
                          className="flex min-w-0 flex-col"
                        >
                          <p
                            className={`whitespace-nowrap text-sm font-semibold uppercase leading-tight tracking-wide ${resolvedTheme.subtext}`}
                          >
                            {detail.title}
                          </p>
                          <div className="mt-auto space-y-1 pt-1">
                            {detail.rows.map((row) => (
                              <div
                                key={`${detail.title}-${row.text}`}
                                className="flex min-w-0 items-center gap-1.5"
                              >
                                {row.icon && (
                                  <span
                                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center ${resolvedTheme.detailIcon}`}
                                  >
                                    {row.icon}
                                  </span>
                                )}
                                <p
                                  className={`truncate text-xs uppercase leading-tight tracking-wide sm:text-xs ${resolvedTheme.subtext}`}
                                >
                                  {row.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    (sublabel || secondarySublabel) && (
                      <div className="space-y-0.5">
                        {sublabel && (
                          <Text
                            className={`text-xs md:text-sm uppercase ${resolvedTheme.subtext}`}
                          >
                            {sublabel}
                          </Text>
                        )}
                        {secondarySublabel && (
                          <Text
                            className={`text-xs uppercase sm:whitespace-nowrap md:text-sm ${resolvedTheme.subtext}`}
                          >
                            {secondarySublabel}
                          </Text>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </NextLink>
        )}
        <button
          type="button"
          onClick={() => {
            setIsVisible(false);
            if (typeof window === "undefined") return;
            try {
              window.localStorage.setItem(dismissKey, Date.now().toString());
            } catch {
              // Ignore storage access errors.
            }
          }}
          className={`absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold shadow-md transition group-hover:-translate-y-1 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 sm:-top-2 sm:-right-2 sm:h-8 sm:w-8 sm:text-xs ${resolvedTheme.dismissPanel} ${resolvedTheme.focusRing}`}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export { FloatingCta };
