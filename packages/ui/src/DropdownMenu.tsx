"use client";

import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import NextLink from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ComponentProps,
  ReactNode,
} from "react";

export type DropdownMenuProps = ComponentProps<typeof Menu>;

export type DropdownMenuButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    unstyled?: boolean;
  };

export type DropdownMenuItemsProps = Omit<
  ComponentProps<typeof MenuItems>,
  "anchor" | "className"
> & {
  align?: "start" | "end";
  className?: string;
};

export type DropdownMenuItemProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  children: ReactNode;
  destructive?: boolean;
};

export type DropdownMenuItemLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "children" | "href"
> & {
  children: ReactNode;
  href: string;
  destructive?: boolean;
};

const DropdownMenu = (props: DropdownMenuProps) => <Menu {...props} />;

const DropdownMenuButton = ({
  className,
  type = "button",
  unstyled = false,
  ...props
}: DropdownMenuButtonProps) => (
  <MenuButton
    type={type}
    className={
      unstyled
        ? className
        : `inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:focus-visible:ring-white/30 ${className ?? ""}`
    }
    {...props}
  />
);

const DropdownMenuItems = ({
  align = "end",
  children,
  className,
  ...props
}: DropdownMenuItemsProps) => (
  <Transition
    enter="transition duration-150 ease-out"
    enterFrom="translate-y-1 scale-95 opacity-0"
    enterTo="translate-y-0 scale-100 opacity-100"
    leave="transition duration-100 ease-in"
    leaveFrom="translate-y-0 scale-100 opacity-100"
    leaveTo="translate-y-1 scale-95 opacity-0"
  >
    <MenuItems
      anchor={`bottom ${align}`}
      className={`z-50 mt-2 flex w-56 origin-top flex-col gap-1 rounded-xl border border-black/10 bg-white/95 p-1.5 text-black shadow-xl backdrop-blur focus:outline-none dark:border-white/10 dark:bg-[#181818]/95 dark:text-white ${className ?? ""}`}
      {...props}
    >
      {children}
    </MenuItems>
  </Transition>
);

const DropdownMenuItem = ({
  children,
  className,
  destructive = false,
  disabled,
  type = "button",
  ...props
}: DropdownMenuItemProps) => (
  <MenuItem disabled={disabled}>
    <button
      type={type}
      disabled={disabled}
      className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition focus:outline-none data-focus:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:data-focus:bg-white/10 [&_svg]:shrink-0 ${destructive ? "text-red-700 dark:text-red-400" : "text-black dark:text-white"} ${className ?? ""}`}
      {...props}
    >
      {children}
    </button>
  </MenuItem>
);

/**
 * A menu entry that navigates. Same styling as `DropdownMenuItem`, but a real
 * anchor, so it can be opened in a new tab and read as a link — which the
 * mobile editor routes need, since their triggers are links by design.
 */
const DropdownMenuItemLink = ({
  children,
  className,
  destructive = false,
  href,
  ...props
}: DropdownMenuItemLinkProps) => (
  <MenuItem>
    <NextLink
      href={href}
      className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition focus:outline-none data-focus:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:data-focus:bg-white/10 [&_svg]:shrink-0 ${destructive ? "text-red-700 dark:text-red-400" : "text-black dark:text-white"} ${className ?? ""}`}
      {...props}
    >
      {children}
    </NextLink>
  </MenuItem>
);

const DropdownMenuSeparator = ({ className }: { className?: string }) => (
  <div
    role="separator"
    className={`my-1 border-t border-black/10 dark:border-white/10 ${className ?? ""}`}
  />
);

DropdownMenuItem.Link = DropdownMenuItemLink;

export {
  DropdownMenu,
  DropdownMenuButton,
  DropdownMenuItem,
  DropdownMenuItemLink,
  DropdownMenuItems,
  DropdownMenuSeparator,
};
