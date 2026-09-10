import Link from "next/link";
import type { ReactNode } from "react";
import { Text } from "./Text";

export type Breadcrumb = {
  current?: boolean;
  icon?: ReactNode;
  href: string;
  title: string;
};

export type BreadcrumbsProps = {
  crumbs: Breadcrumb[];
  className?: string;
  variant?: "default" | "compact";
};

const Breadcrumbs = ({
  crumbs,
  className = "",
  variant = "default",
}: BreadcrumbsProps) => {
  const compact = variant === "compact";

  return (
    <nav aria-label="Breadcrumb" className={`min-w-0 ${className}`}>
      {/* The trail never wraps: ancestors keep their full label and the
          current crumb absorbs the leftover width by truncating. */}
      <ol
        className={
          compact
            ? "flex min-w-0 items-center gap-2"
            : "mb-2 flex min-w-0 items-center gap-x-3 sm:gap-x-4"
        }
      >
        {crumbs.map((crumb, index) => {
          const current = index === crumbs.length - 1 || crumb.current === true;

          return (
            <li
              className={
                compact
                  ? `flex min-w-0 items-center gap-2 text-sm ${current ? "flex-1" : "shrink-0"}`
                  : `flex min-w-0 items-center gap-3 text-lg sm:gap-4 ${current ? "flex-1" : "shrink-0"}`
              }
              key={`${crumb.href}-${crumb.title}`}
            >
              {current ? (
                <span
                  aria-current="page"
                  title={crumb.title}
                  className={
                    compact
                      ? "inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-black dark:text-white"
                      : "flex min-w-0 items-center font-semibold text-black dark:text-white"
                  }
                >
                  {crumb.icon}
                  <Text
                    className={
                      compact
                        ? "truncate text-inherit"
                        : "title truncate text-inherit"
                    }
                  >
                    {crumb.title}
                  </Text>
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  aria-current={current ? "page" : undefined}
                  className={
                    compact
                      ? "group inline-flex min-w-0 items-center gap-1.5 rounded text-sm font-semibold text-black/60 hover:text-black hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:text-white/60 dark:hover:text-white dark:focus-visible:ring-white/40"
                      : "group flex min-w-0 items-center timing hover:scale-102 hover:underline"
                  }
                >
                  {crumb.icon}
                  <Text
                    className={
                      compact
                        ? "whitespace-nowrap text-inherit"
                        : "whitespace-nowrap text-gray-700 group-hover:text-black dark:text-gray-400 dark:group-hover:text-white"
                    }
                  >
                    {crumb.title}
                  </Text>
                </Link>
              )}

              {index !== crumbs.length - 1 && (
                <span aria-hidden className="shrink-0 text-gray-400">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export { Breadcrumbs };
