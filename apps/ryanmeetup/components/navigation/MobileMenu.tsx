"use client";

// Components
import {
  Transition,
  Disclosure,
  DisclosureButton,
  Dialog,
  DialogPanel,
} from "@headlessui/react";
import NextLink from "next/link";
import { GiHamburgerMenu as Hamburger } from "react-icons/gi";
import { FaChevronDown as ChevronDown } from "react-icons/fa6";
import { FaDollarSign as Dollar } from "react-icons/fa";
import { MdClose as Close } from "react-icons/md";
import { AnimatedDisclosurePanel, IconButton } from "@ryanmeetup/ui";

// Types
import { Fragment, useState } from "react";
import type { ReactNode } from "react";
import type { Route } from "@/lib/types";
import { usePathname } from "next/navigation";

type MenuOption = {
  icon: ReactNode;
  text: string;
  href: string;
  subroutes?: Route[];
  description?: string;
};

type MobileMenuProps = {
  content: MenuOption[];
};

const MobileMenu = (props: MobileMenuProps) => {
  const { content } = props;
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex items-center justify-center">
      <div className="relative inline-block text-left z-10">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm flex items-center font-semibold rounded-lg tracking-wide gap-x-2 px-3 py-1.5 transition hover:shadow-sm hover:bg-black/5 text-black dark:text-white dark:hover:text-white dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/30"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-menu-drawer"
        >
          <Hamburger />
          Menu
        </button>
        <Transition show={open} as={Fragment}>
          <Dialog onClose={setOpen} className="relative z-[10000]">
            <Transition.Child
              as={Fragment}
              enter="transition-opacity duration-200"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity duration-150"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            </Transition.Child>

            <div className="fixed inset-0 flex justify-end">
              <Transition.Child
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in duration-150"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <DialogPanel
                  id="mobile-menu-drawer"
                  className="relative flex h-full w-[92vw] max-w-sm flex-col border-l border-black/10 bg-white/95 p-4 pb-0 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-black/95"
                >
                  <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between border-b border-black/10 bg-white/95 px-4 pb-3 pt-0 backdrop-blur dark:border-white/10 dark:bg-black/95">
                    <div className="text-sm font-semibold uppercase tracking-[0.2em] text-black/70 dark:text-white/70">
                      Menu
                    </div>
                    <IconButton
                      onClick={() => setOpen(false)}
                      label="Close menu"
                    >
                      <Close className="h-5 w-5" />
                    </IconButton>
                  </div>

                  <div className="mt-4 flex-1 overflow-y-auto pr-1">
                    <NextLink
                      href="/donate"
                      className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-black px-3 py-2.5 text-sm font-semibold tracking-wide text-white shadow-sm transition hover:bg-black/90 active:scale-[0.99] dark:bg-white dark:text-black dark:hover:bg-white/90"
                    >
                      <Dollar className="h-4 w-4" /> Donate
                    </NextLink>
                    <div className="grid gap-3">
                      {content.map((row) =>
                        !row.subroutes ? (
                          <NextLink
                            key={row.text}
                            className={`group flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold tracking-wide shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] ${
                              pathname === row.href
                                ? "border-black/30 bg-black/5 text-black dark:border-white/40 dark:bg-white/10 dark:text-white"
                                : "border-black/10 bg-white text-black hover:border-black/20 hover:bg-black/5 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:border-white/30 dark:hover:bg-white/10"
                            }`}
                            href={row.href}
                            onClick={() => setOpen(false)}
                          >
                            <span className="flex flex-col gap-1">
                              <span className="flex items-center gap-2">
                                {row.icon} {row.text}
                              </span>
                              {row.description && (
                                <span className="text-[12px] font-normal leading-relaxed text-black/70 dark:text-white/70">
                                  {row.description}
                                </span>
                              )}
                            </span>
                            <span className="text-xs opacity-0 transition group-hover:opacity-100">
                              →
                            </span>
                          </NextLink>
                        ) : (
                          <Disclosure key={row.text}>
                            {({ open: disclosureOpen }) => (
                              <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-2 dark:border-white/10 dark:bg-white/[0.04]">
                                <DisclosureButton className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/10 bg-white px-3 py-3 text-left text-sm font-semibold tracking-wide text-black shadow-sm transition hover:-translate-y-0.5 hover:border-black/20 hover:bg-black/5 hover:shadow-md active:scale-[0.99] dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:border-white/30 dark:hover:bg-white/10">
                                  <span className="flex flex-col gap-1">
                                    <span className="flex items-center gap-2">
                                      {row.icon} {row.text}
                                    </span>
                                    {row.description && (
                                      <span className="text-[12px] font-normal leading-relaxed text-black/70 dark:text-white/70">
                                        {row.description}
                                      </span>
                                    )}
                                  </span>
                                  <ChevronDown
                                    className={`h-3 w-3 fill-gray-700 timing dark:fill-gray-200 ${disclosureOpen && "-rotate-180"}`}
                                  />
                                </DisclosureButton>
                                <AnimatedDisclosurePanel
                                  open={disclosureOpen}
                                  className="mt-3 flex flex-wrap gap-2 border-t border-black/10 pt-3 dark:border-white/10"
                                >
                                  {row.subroutes &&
                                    row.subroutes.map((route) => (
                                      <NextLink
                                        key={route.text}
                                        className={`group inline-flex flex-col gap-1 rounded-full border px-3 py-2 text-[13px] font-semibold tracking-wide shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] ${
                                          pathname === route.href
                                            ? "border-black/30 bg-black/5 text-black dark:border-white/40 dark:bg-white/10 dark:text-white"
                                            : "border-black/10 bg-white text-black hover:border-black/20 hover:bg-black/5 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:border-white/30 dark:hover:bg-white/10"
                                        }`}
                                        href={route.href}
                                        onClick={() => setOpen(false)}
                                      >
                                        <span className="flex items-center justify-between gap-3">
                                          <span className="flex items-center gap-2">
                                            {route.icon} {route.text}
                                          </span>
                                          <span className="text-xs opacity-0 transition group-hover:opacity-100">
                                            →
                                          </span>
                                        </span>
                                      </NextLink>
                                    ))}
                                </AnimatedDisclosurePanel>
                              </div>
                            )}
                          </Disclosure>
                        ),
                      )}
                    </div>
                  </div>
                </DialogPanel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>
      </div>
    </div>
  );
};

export { MobileMenu };
