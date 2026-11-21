"use client";

import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

export type DropdownPanelProps = ComponentProps<typeof Popover>;

export type DropdownPanelButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement>;

export type DropdownPanelContentProps = Omit<
  ComponentProps<typeof PopoverPanel>,
  "anchor" | "className"
> & {
  align?: "start" | "end";
  className?: string;
};

/**
 * A floating panel styled like `DropdownMenuItems`, for content a menu can't
 * hold: form controls such as `DropdownSelect`, or several choices made before
 * one action. A menu closes on every click; this stays open until dismissed or
 * closed through the panel's `close` render prop.
 */
const DropdownPanel = (props: DropdownPanelProps) => <Popover {...props} />;

const DropdownPanelButton = ({
  type = "button",
  ...props
}: DropdownPanelButtonProps) => <PopoverButton type={type} {...props} />;

const DropdownPanelContent = ({
  align = "end",
  className,
  ...props
}: DropdownPanelContentProps) => (
  <Transition
    enter="transition duration-150 ease-out"
    enterFrom="translate-y-1 scale-95 opacity-0"
    enterTo="translate-y-0 scale-100 opacity-100"
    leave="transition duration-100 ease-in"
    leaveFrom="translate-y-0 scale-100 opacity-100"
    leaveTo="translate-y-1 scale-95 opacity-0"
  >
    <PopoverPanel
      anchor={{ to: `bottom ${align}`, padding: 16 }}
      className={`z-50 mt-2 flex w-56 max-w-[calc(100vw-2rem)] origin-top flex-col gap-1 rounded-xl border border-black/10 bg-white/95 p-1.5 text-black shadow-xl backdrop-blur focus:outline-none dark:border-white/10 dark:bg-[#181818]/95 dark:text-white ${className ?? ""}`}
      {...props}
    />
  </Transition>
);

export { DropdownPanel, DropdownPanelButton, DropdownPanelContent };
