"use client";

import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import Link from "next/link";
import { FaChevronDown as ChevronDown } from "react-icons/fa6";
import { useCallback, useRef, useState } from "react";
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
    className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold tracking-wide transition hover:bg-black/5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:hover:bg-white/10 dark:focus-visible:ring-white/40 2xl:px-4 2xl:text-sm ${active ? "bg-black/15 text-black shadow-sm ring-1 ring-black/10 dark:bg-white/25 dark:text-white dark:ring-white/20" : "text-black dark:text-white"} ${className ?? ""}`}
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
  const caretCleanupRef = useRef<(() => void) | null>(null);
  const [openedByHover, setOpenedByHover] = useState(false);
  const positionCaret = useCallback((panel: HTMLDivElement | null) => {
    caretCleanupRef.current?.();
    caretCleanupRef.current = null;
    const button = buttonRef.current;
    if (!panel || !button) return;

    const update = () => {
      const trigger = button.getBoundingClientRect();
      const bounds = panel.getBoundingClientRect();
      const center = trigger.left + trigger.width / 2 - bounds.left;
      const position = `${Math.max(24, Math.min(bounds.width - 24, center))}px`;
      if (panel.style.getPropertyValue("--nav-caret-x") !== position) {
        panel.style.setProperty("--nav-caret-x", position);
      }
    };
    const resizeObserver = new ResizeObserver(update);
    const positionObserver = new MutationObserver(update);
    resizeObserver.observe(button);
    resizeObserver.observe(panel);
    // Headless UI shifts its anchored panel to keep it inside the viewport.
    positionObserver.observe(panel, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("scroll", update, true);
    update();

    caretCleanupRef.current = () => {
      resizeObserver.disconnect();
      positionObserver.disconnect();
      window.removeEventListener("scroll", update, true);
    };
  }, []);

  return (
    <Popover className="relative">
      {({ open, close }) => (
        <div
          onMouseEnter={() => {
            if (!open) {
              buttonRef.current?.click();
              // Headless UI focuses the trigger after this synthetic click.
              // Keep its keyboard ring for deliberate focus, not hover opens.
              setOpenedByHover(true);
            }
          }}
          onMouseLeave={() => {
            if (open) close();
          }}
        >
          <PopoverButton
            ref={buttonRef}
            onFocus={() => setOpenedByHover(false)}
            onKeyDown={() => setOpenedByHover(false)}
            className={`flex cursor-pointer items-center gap-x-2 rounded-full px-3 py-2 text-xs font-semibold tracking-wide text-black transition hover:bg-black/5 hover:shadow-sm focus:outline-none dark:text-white dark:hover:bg-white/10 2xl:px-4 2xl:text-sm ${openedByHover ? "" : "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:focus-visible:ring-white/40"} ${
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
              ref={positionCaret}
              anchor={{ to: "bottom", gap: 16 }}
              className={`z-50 overflow-visible! rounded-2xl border border-black/10 bg-white p-4 shadow-overlay before:absolute before:inset-x-0 before:-top-4 before:h-4 dark:border-white/20 dark:bg-[color-mix(in_srgb,white_10%,black)] ${hasDescriptions ? "w-[780px]" : "w-64"} ${className ?? ""}`}
            >
              {/* Override Headless UI's inline overflow so the caret and hover
                  bridge remain outside the panel. The bridge keeps pointer
                  navigation continuous across the gap beneath the trigger. */}
              <span
                aria-hidden="true"
                data-nav-caret=""
                className="pointer-events-none absolute left-[var(--nav-caret-x,50%)] top-0 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-black/10 bg-white dark:border-white/20 dark:bg-[color-mix(in_srgb,white_10%,black)]"
              />
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
                    className="group block rounded-xl border border-transparent px-3 py-2 transition hover:border-black/10 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:hover:border-white/10 dark:hover:bg-white/10 dark:focus-visible:ring-white/40"
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
