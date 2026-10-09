// Components
import {
  Transition,
  Disclosure,
  DisclosureButton,
  Popover,
  PopoverButton,
  PopoverPanel,
} from "@headlessui/react";
import NextLink from "next/link";
import { AnimatedDisclosurePanel } from "@ryanmeetup/ui";
import { GiHamburgerMenu as Hamburger } from "react-icons/gi";
import { FaChevronDown as ChevronDown } from "react-icons/fa6";

// Types
import type { ReactNode } from "react";
import type { Route } from "@/lib/types";

type MenuOption = {
  icon: ReactNode;
  text: string;
  href: string;
  subroutes?: Route[];
};

type MobileMenuProps = {
  content: MenuOption[];
};

const MobileMenu = (props: MobileMenuProps) => {
  const { content } = props;

  return (
    <div className="flex items-center justify-center">
      <div className="relative inline-block text-left z-10">
        <Popover className="relative">
          <PopoverButton className="text-sm flex items-center font-semibold rounded-lg text-black dark:text-white tracking-wide gap-x-2 p-2 shrink-0 border border-gray-700 timing 2xl:text-base timing hover:bg-gray-800">
            <Hamburger />
            Menu
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
              className="z-50 bg-white w-48 rounded-lg border border-gray-700 p-2 mt-2 "
              anchor="bottom end"
            >
              {content.map((row) =>
                !row.subroutes ? (
                  <NextLink
                    key={row.text}
                    className="text-gray-900 flex items-center w-full px-4 py-2 gap-x-2 text-sm leading-5 text-left hover:bg-gray-200 hover:rounded"
                    href={row.href}
                  >
                    {row.icon} {row.text}
                  </NextLink>
                ) : (
                  <Disclosure key={row.text}>
                    {({ open }) => (
                      <>
                        <DisclosureButton className="text-gray-900 flex items-center w-full px-4 py-2 gap-x-2 text-sm leading-5 text-left hover:bg-gray-200 hover:rounded">
                          {row.icon} {row.text}{" "}
                          <ChevronDown
                            className={`h-3 w-3 fill-gray-600 timing ${open && "-rotate-180"}`}
                          />
                        </DisclosureButton>
                        <AnimatedDisclosurePanel open={open} className="pl-6">
                          {row.subroutes &&
                            row.subroutes.map((route) => (
                              <NextLink
                                key={route.text}
                                className="text-gray-900 flex items-center w-full px-4 py-2 gap-x-2 text-sm leading-5 text-left hover:bg-gray-200 hover:rounded"
                                href={route.href}
                              >
                                {route.icon} {route.text}
                              </NextLink>
                            ))}
                        </AnimatedDisclosurePanel>
                      </>
                    )}
                  </Disclosure>
                ),
              )}
            </PopoverPanel>
          </Transition>
        </Popover>
      </div>
    </div>
  );
};

export { MobileMenu };
