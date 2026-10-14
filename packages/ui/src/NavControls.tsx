"use client";

import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import Link from "next/link";
import { FaChevronDown as ChevronDown } from "react-icons/fa6";
import { useRef } from "react";
import type { ReactNode } from "react";

export type NavRoute = {
  icon?: ReactNode;
  text: string;
  href: string;
  description?: string;
};
export type NavItemProps = NavRoute & { active?: boolean; className?: string };

const NavItem = ({ icon, text, href, active, className }: NavItemProps) => (
  <Link
    href={href}
    className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold tracking-wide transition hover:bg-black/5 hover:shadow-sm dark:hover:bg-white/10 2xl:px-4 2xl:text-sm ${active ? "bg-black/15 text-black shadow-sm ring-1 ring-black/10 dark:bg-white/25 dark:text-white dark:ring-white/20" : "text-black dark:text-white"} ${className ?? ""}`}
  >
    {icon}
    {text}
  </Link>
);

export type NavMenuProps = {
  icon?: ReactNode;
  title: string;
  routes: NavRoute[];
  pathname: string;
  className?: string;
};

const NavMenu = ({
  icon,
  title,
  routes,
  pathname,
  className,
}: NavMenuProps) => {
  const active = routes.some((route) => route.href === pathname);
  const hasDescriptions = routes.some((route) => route.description);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <Popover className="relative">
      {({ open, close }) => (
        <div
          onMouseEnter={() => {
            if (!open) buttonRef.current?.click();
          }}
          onMouseLeave={() => {
            if (open) close();
          }}
        >
          <PopoverButton
            ref={buttonRef}
            className={`flex cursor-pointer items-center gap-x-2 rounded-full px-3 py-2 text-xs font-semibold tracking-wide text-black transition hover:bg-black/5 hover:shadow-sm focus:outline-none dark:text-white dark:hover:bg-white/10 2xl:px-4 2xl:text-sm ${
              active
                ? "bg-black/15 text-black shadow-sm ring-1 ring-black/10 dark:bg-white/25 dark:text-white dark:ring-white/20"
                : ""
            }`}
          >
            {icon}
            {title}
            <ChevronDown
              className={`h-3 w-3 fill-gray-700 transition dark:fill-gray-200 ${open ? "-rotate-180" : ""}`}
            />
          </PopoverButton>
          <Transition
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <PopoverPanel
              anchor="bottom"
              className={`z-50 rounded-2xl border border-black/10 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-white/10 dark:bg-black/95 ${hasDescriptions ? "w-[720px]" : "w-64"} ${className ?? ""}`}
            >
              <div
                className={
                  hasDescriptions
                    ? "grid grid-cols-3 auto-rows-fr gap-3"
                    : "space-y-1"
                }
              >
                {routes.map((route) => (
                  <Link
                    key={route.text}
                    href={route.href}
                    className="group block rounded-xl border border-transparent px-3 py-2 transition hover:border-black/10 hover:bg-black/5 dark:hover:border-white/10 dark:hover:bg-white/10"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold tracking-wide text-black dark:text-white xl:text-base">
                      {route.icon}
                      {route.text}
                    </span>
                    {route.description && (
                      <span className="mt-1 block text-sm leading-relaxed text-black/70 dark:text-white/70">
                        {route.description}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </PopoverPanel>
          </Transition>
        </div>
      )}
    </Popover>
  );
};

export { NavItem, NavMenu };
