"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { FiChevronDown, FiMenu, FiPackage, FiShoppingBag, FiX } from "react-icons/fi";
import { AnimatedCollapse, NavMenu, Wordmark } from "@ryanmeetup/ui";
import { getCollectionMenuRoutes, storeNavigation } from "@/lib/navigation";
import type { StoreMenuCollection } from "@/lib/navigation";
import { useCart } from "./cart-provider";
import { useNavSection } from "./nav-section";
import { ThemeToggle } from "./theme-toggle";

// Shopify's customer account, where a shopper finds order status and tracking.
const accountLabel = "Your orders";

export function Header({ collections, accountUrl }: { collections: StoreMenuCollection[]; accountUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const section = useNavSection();
  // A product page sits under its type's link even though its path doesn't match it.
  const isCurrent = (href: string) => pathname === href || section === href;
  const collectionRoutes = useMemo(() => getCollectionMenuRoutes(collections), [collections]);
  // Starts expanded on a page in the menu so the mobile menu shows where you are.
  const [collectionsOpen, setCollectionsOpen] = useState(() =>
    collectionRoutes.some((route) => route.href === pathname),
  );
  const { cart, drawerOpen, setDrawerOpen } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/70">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_20%_10%,rgba(0,0,0,0.06),transparent_60%),radial-gradient(45%_70%_at_80%_0%,rgba(0,0,0,0.04),transparent_55%)] dark:bg-[radial-gradient(60%_80%_at_20%_10%,rgba(255,255,255,0.08),transparent_60%),radial-gradient(45%_70%_at_80%_0%,rgba(255,255,255,0.05),transparent_55%)]"
      />
      <div className="store-container relative flex min-h-16 items-center gap-4 py-3">
        <Link
          href="/"
          className="w-fit rounded-sm transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40"
        >
          <Wordmark name="RYAN MEETUP" tagline="Official Merch Store" compact />
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden min-w-0 flex-1 items-center justify-center xl:flex"
        >
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-black/10 bg-white/70 p-1 shadow-sm backdrop-blur dark:border-white/20 dark:bg-white/10 dark:ring-1 dark:ring-white/10 2xl:p-1.5">
            {storeNavigation.map(({ icon: Icon, label, ...item }) =>
              "menu" in item ? (
                <NavMenu
                  key={label}
                  icon={<Icon aria-hidden className="shrink-0" />}
                  title={label}
                  routes={collectionRoutes}
                  pathname={pathname}
                />
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isCurrent(item.href) ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold tracking-wide transition hover:bg-black/5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:hover:bg-white/10 dark:focus-visible:ring-white/40 2xl:text-sm ${isCurrent(item.href) ? "bg-black/15 shadow-sm ring-1 ring-black/10 dark:bg-white/25 dark:ring-white/20" : ""}`}
                >
                  <Icon aria-hidden className="shrink-0" />
                  {label}
                </Link>
              ),
            )}
          </div>
        </nav>
        <div className="ml-auto flex flex-none items-center gap-2 sm:gap-4">
          {/* Phones reach it from the menu instead. The label drops wherever it would
              wrap the wordmark or crowd the main navigation into scrolling. */}
          {accountUrl && (
            <div className="hidden sm:block">
              <a
                href={accountUrl}
                aria-label={accountLabel}
                title={accountLabel}
                className="inline-flex h-10 w-10 items-center justify-center gap-2 rounded-full border border-black/15 bg-white/70 text-xs font-semibold tracking-wide shadow-sm transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 md:w-auto md:px-4 xl:w-10 xl:px-0 dark:border-white/20 dark:bg-white/10 dark:hover:bg-white/15 dark:focus-visible:ring-white/40"
              >
                <FiPackage aria-hidden className="text-base" />
                <span aria-hidden className="hidden md:inline xl:hidden">{accountLabel}</span>
              </a>
            </div>
          )}
          {/* Opens the drawer rather than /cart: the page still works but stays
              unlinked while we hear which of the two shoppers prefer. */}
          <button
            type="button"
            aria-label={`Cart with ${cart?.totalQuantity ?? 0} items`}
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="relative inline-flex h-10 items-center justify-center gap-2 rounded-full bg-black px-3 text-xs font-semibold tracking-wide text-white shadow-sm transition hover:scale-[1.02] hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 sm:px-4 dark:bg-white dark:text-black dark:hover:bg-white/90 dark:focus-visible:ring-white/40"
          >
            <FiShoppingBag aria-hidden className="text-base" />
            <span className="hidden sm:inline">Cart</span>
            {(cart?.totalQuantity ?? 0) > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-nametag px-1 text-[10px] font-bold text-white">
                {cart?.totalQuantity}
              </span>
            )}
          </button>
          <button
            type="button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold tracking-wide transition hover:bg-black/5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 sm:px-3 xl:hidden dark:hover:bg-white/10 dark:focus-visible:ring-white/40"
          >
            {open ? (
              <FiX aria-hidden className="h-5 w-5" />
            ) : (
              <FiMenu aria-hidden className="h-5 w-5" />
            )}
            <span className="hidden sm:inline">{open ? "Close" : "Menu"}</span>
          </button>
          <ThemeToggle />
        </div>
      </div>
      {open && (
        <nav
          aria-label="Mobile navigation"
          className="store-container relative grid gap-1 border-t border-black/10 py-3 xl:hidden dark:border-white/10"
        >
          {storeNavigation.map(({ description, icon: Icon, label, ...item }) =>
            "menu" in item ? (
              <div
                key={label}
                className="rounded-2xl border border-black/10 bg-black/[0.02] p-1.5 dark:border-white/10 dark:bg-white/[0.04]"
              >
                <button
                  type="button"
                  aria-expanded={collectionsOpen}
                  aria-controls="mobile-collections"
                  onClick={() => setCollectionsOpen((value) => !value)}
                  className="grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-left text-sm shadow-sm transition hover:border-black/20 hover:bg-black/5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/15 dark:bg-white/5 dark:hover:border-white/30 dark:hover:bg-white/10 dark:focus-visible:ring-white/40"
                >
                  <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="block font-semibold tracking-wide">
                      {label}
                    </span>
                    <span className="mt-1 block text-xs font-normal leading-relaxed text-black/70 dark:text-white/70">
                      {description}
                    </span>
                  </span>
                  <FiChevronDown
                    aria-hidden
                    className={`mt-0.5 h-4 w-4 transition motion-reduce:transition-none ${collectionsOpen ? "-rotate-180" : ""}`}
                  />
                </button>
                <AnimatedCollapse id="mobile-collections" open={collectionsOpen}>
                  <div className="flex flex-wrap gap-2 px-1.5 pb-1.5 pt-3">
                    {collectionRoutes.map((route) => (
                      <Link
                        key={route.href}
                        href={route.href}
                        aria-current={pathname === route.href ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-semibold tracking-wide shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40 ${pathname === route.href ? "border-black/30 bg-black/5 dark:border-white/40 dark:bg-white/10" : "border-black/10 bg-white hover:border-black/20 hover:bg-black/5 dark:border-white/15 dark:bg-white/5 dark:hover:border-white/30 dark:hover:bg-white/10"}`}
                      >
                        {route.icon}
                        {route.text}
                      </Link>
                    ))}
                  </div>
                </AnimatedCollapse>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent(item.href) ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`grid grid-cols-[auto_1fr] items-start gap-3 rounded-xl border px-3 py-3 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40 ${isCurrent(item.href) ? "border-black/30 bg-black/5 dark:border-white/40 dark:bg-white/10" : "border-black/10 bg-white/70 hover:border-black/20 hover:bg-black/5 dark:border-white/15 dark:bg-white/5 dark:hover:border-white/30 dark:hover:bg-white/10"}`}
              >
                <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="block font-semibold tracking-wide">
                    {label}
                  </span>
                  <span className="mt-1 block text-xs font-normal leading-relaxed text-black/70 dark:text-white/70">
                    {description}
                  </span>
                </span>
              </Link>
            ),
          )}
          {accountUrl && (
            <a
              href={accountUrl}
              className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-xl border border-black/10 bg-white/70 px-3 py-3 text-sm shadow-sm transition hover:-translate-y-0.5 hover:border-black/20 hover:bg-black/5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/15 dark:bg-white/5 dark:hover:border-white/30 dark:hover:bg-white/10 dark:focus-visible:ring-white/40"
            >
              <FiPackage aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="block font-semibold tracking-wide">{accountLabel}</span>
                <span className="mt-1 block text-xs font-normal leading-relaxed text-black/70 dark:text-white/70">
                  Order status and tracking, no inbox archaeology required.
                </span>
              </span>
            </a>
          )}
        </nav>
      )}
    </header>
  );
}
