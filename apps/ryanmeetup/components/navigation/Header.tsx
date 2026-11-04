"use client";

// Components
import { Wordmark } from "@ryanmeetup/ui";
import { RouteMenu, ThemeToggle } from "@/components/navigation";
import NextLink from "next/link";
import { MobileMenu } from "@/components/navigation";
import { FaDollarSign as Dollar } from "react-icons/fa";

// Utilities
import { usePathname } from "next/navigation";
import { layoutPaddingX, routes } from "@/lib/constants";

const Header = () => {
  const pathname = usePathname();

  const headerRoutes = routes;
  const desktopRoutes = headerRoutes.filter((route) => route.href !== "/");

  return (
    <header className="sticky top-0 z-30 relative border-b border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/70">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_20%_10%,rgba(0,0,0,0.06),transparent_60%),radial-gradient(45%_70%_at_80%_0%,rgba(0,0,0,0.04),transparent_55%)] dark:bg-[radial-gradient(60%_80%_at_20%_10%,rgba(255,255,255,0.08),transparent_60%),radial-gradient(45%_70%_at_80%_0%,rgba(255,255,255,0.05),transparent_55%)]" />
      <div
        className={`relative flex items-center gap-4 py-3 ${layoutPaddingX}`}
      >
        <NextLink
          href="/"
          className="title group flex items-center tracking-[0.2em] timing hover:scale-105"
        >
          <Wordmark name="RYAN" />
        </NextLink>

        <nav className="hidden min-w-0 flex-1 items-center justify-center xl:flex">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-black/10 bg-white/70 p-1 shadow-sm backdrop-blur dark:border-white/20 dark:bg-white/10 dark:ring-1 dark:ring-white/10 2xl:gap-2 2xl:p-1.5">
            {desktopRoutes.map((route) =>
              !route.subroutes ? (
                <NextLink
                  key={route.text}
                  className={`flex items-center gap-x-2 rounded-full px-3 py-2 text-xs font-semibold tracking-wide text-black transition timing hover:bg-black/5 hover:shadow-sm dark:text-white dark:hover:bg-white/10 2xl:px-4 2xl:text-sm ${
                    route.href === "/"
                      ? pathname === "/"
                        ? "bg-black/15 text-black shadow-sm ring-1 ring-black/10 dark:bg-white/25 dark:text-white dark:ring-white/20"
                        : ""
                      : route.href.includes(pathname) && pathname !== "/"
                        ? "bg-black/15 text-black shadow-sm ring-1 ring-black/10 dark:bg-white/25 dark:text-white dark:ring-white/20"
                        : ""
                  }`}
                  href={route.href}
                >
                  {route.icon} {route.text}
                </NextLink>
              ) : (
                <RouteMenu
                  key={route.text}
                  icon={route.icon}
                  title={route.text}
                  routes={route.subroutes}
                  pathname={pathname}
                />
              ),
            )}
          </div>
        </nav>

        <div className="ml-auto flex flex-none items-center gap-x-4">
          <NextLink
            href="/donate"
            className="hidden items-center rounded-full bg-black px-4 py-2 text-xs font-semibold tracking-wide text-white shadow-sm transition hover:scale-[1.02] hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 xl:inline-flex xl:text-sm"
          >
            <Dollar className="mr-2" /> Donate
          </NextLink>
          <div className="xl:hidden">
            <MobileMenu content={headerRoutes} />
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export { Header };
