"use client";

import { DisclosurePanel } from "@headlessui/react";
import type { ReactNode } from "react";
import { AnimatedCollapse } from "./AnimatedCollapse";

export type AnimatedDisclosurePanelProps = {
  children: ReactNode;
  className?: string;
  /** The parent Disclosure's open state, from its render prop. */
  open: boolean;
};

/**
 * A Headless UI DisclosurePanel that grows and shrinks with AnimatedCollapse
 * instead of mounting and unmounting in a single frame. The panel stays
 * mounted while closed so its height can animate back to zero.
 */
export function AnimatedDisclosurePanel({
  children,
  className,
  open,
}: AnimatedDisclosurePanelProps) {
  return (
    <AnimatedCollapse open={open}>
      <DisclosurePanel static className={className}>
        {children}
      </DisclosurePanel>
    </AnimatedCollapse>
  );
}
