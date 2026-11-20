import {
  FiActivity,
  FiColumns,
  FiSettings,
  FiShield,
  FiSliders,
} from "react-icons/fi";

/**
 * Owner-only routes. These moved under /admin so the header no longer has to
 * carry a separate control per tool; `next.config.ts` permanently redirects the
 * pre-move paths.
 */
export const ADMIN_ROOT = "/admin";

/**
 * The icon on each route is the one that section leads with, so the tab strip
 * and the overview cards stay in sync with the page they point at.
 */
export const adminRoutes = [
  { href: "/admin", label: "Overview", exact: true, icon: FiSliders },
  { href: "/admin/statuses", label: "Statuses", exact: false, icon: FiColumns },
  { href: "/admin/access", label: "Access", exact: false, icon: FiShield },
  { href: "/admin/usage", label: "Usage", exact: false, icon: FiActivity },
  {
    href: "/admin/settings",
    label: "Settings",
    exact: false,
    icon: FiSettings,
  },
] as const;

export const adminAccessPath = "/admin/access";
export const adminAccessGroupPath = (slug: string) => `/admin/access/${slug}`;

export function isActiveAdminRoute(
  pathname: string,
  route: (typeof adminRoutes)[number],
) {
  return route.exact
    ? pathname === route.href
    : pathname === route.href || pathname.startsWith(`${route.href}/`);
}
