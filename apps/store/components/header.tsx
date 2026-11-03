"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { FiMenu, FiShoppingBag, FiX } from "react-icons/fi";
import { Heading } from "@ryanmeetup/ui";
import { storeNavigation } from "@/lib/navigation";
import { useCart } from "./cart-provider";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  const [open, setOpen] = useState(false);
  const { cart, drawerOpen, setDrawerOpen } = useCart();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/70">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_20%_10%,rgba(0,0,0,0.06),transparent_60%),radial-gradient(45%_70%_at_80%_0%,rgba(0,0,0,0.04),transparent_55%)] dark:bg-[radial-gradient(60%_80%_at_20%_10%,rgba(255,255,255,0.08),transparent_60%),radial-gradient(45%_70%_at_80%_0%,rgba(255,255,255,0.05),transparent_55%)]"
      />
      <div className="store-container relative flex min-h-16 items-center gap-4 py-3">
        <Link
          href="/"
          className="group w-fit rounded-sm tracking-[0.2em] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40"
        >
          <Heading size="h1" className="text-2xl leading-none sm:text-3xl">
            RYAN
          </Heading>
          <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[0.34em] text-black/55 dark:text-white/55 sm:text-[9px]">
            General Store
          </span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden min-w-0 flex-1 items-center justify-center xl:flex"
        >
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-black/10 bg-white/70 p-1 shadow-sm backdrop-blur dark:border-white/20 dark:bg-white/10 dark:ring-1 dark:ring-white/10 2xl:gap-2 2xl:p-1.5">
            {storeNavigation.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold tracking-wide transition hover:bg-black/5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:hover:bg-white/10 dark:focus-visible:ring-white/40 2xl:px-4 2xl:text-sm ${pathname === href ? "bg-black/15 shadow-sm ring-1 ring-black/10 dark:bg-white/25 dark:ring-white/20" : ""}`}
              >
                <Icon aria-hidden className="shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </nav>
        <div className="ml-auto flex flex-none items-center gap-2 sm:gap-4">
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
          {storeNavigation.map(({ description, href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={`grid grid-cols-[auto_1fr] items-start gap-3 rounded-xl border px-3 py-3 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40 ${pathname === href ? "border-black/30 bg-black/5 dark:border-white/40 dark:bg-white/10" : "border-black/10 bg-white/70 hover:border-black/20 hover:bg-black/5 dark:border-white/15 dark:bg-white/5 dark:hover:border-white/30 dark:hover:bg-white/10"}`}
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
          ))}
        </nav>
      )}
    </header>
  );
}
