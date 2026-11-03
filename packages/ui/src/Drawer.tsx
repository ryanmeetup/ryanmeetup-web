"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { MdClose as Close } from "react-icons/md";
import type { ReactNode } from "react";
import { EditorHeader } from "./editorChrome";
import { IconButton } from "./IconButton";

export type DrawerProps = {
  open: boolean;
  setIsOpen: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Pinned below the scrolling body — a summary and the primary actions. */
  footer?: ReactNode;
  panelClassName?: string;
  bodyClassName?: string;
};

/**
 * A panel that slides in from the right edge. Unlike `Modal` it holds no
 * unsaved input, so a click on the dimmed area dismisses it.
 */
const Drawer = ({
  open,
  setIsOpen,
  title,
  description,
  children,
  footer,
  panelClassName,
  bodyClassName,
}: DrawerProps) => (
  <Dialog open={open} onClose={setIsOpen} className="relative z-50">
    <DialogBackdrop
      transition
      className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity duration-200 ease-out data-closed:opacity-0 motion-reduce:transition-none dark:bg-black/80"
    />
    <div className="fixed inset-0 flex justify-end overflow-hidden">
      <DialogPanel
        transition
        className={`flex h-full w-full max-w-md flex-col border-l border-black/15 bg-white pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-[0_24px_80px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-out data-closed:translate-x-full motion-reduce:transition-none dark:border-white/20 dark:bg-[#181818] ${panelClassName ?? ""}`}
      >
        <EditorHeader
          title={title}
          description={description}
          titleAs={DialogTitle}
          descriptionAs={DialogDescription}
          action={
            <IconButton label="Close panel" onClick={() => setIsOpen(false)}>
              <Close className="h-5 w-5" />
            </IconButton>
          }
        />
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 ${bodyClassName ?? ""}`}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-black/10 px-6 py-4 dark:border-white/10">
            {footer}
          </div>
        )}
      </DialogPanel>
    </div>
  </Dialog>
);

export { Drawer };
