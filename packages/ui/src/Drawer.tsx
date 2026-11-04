"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { MdClose as Close } from "react-icons/md";
import { useEffect, useState, type ReactNode } from "react";
import { EditorHeader } from "./editorChrome";
import { IconButton } from "./IconButton";
import { ScrollRegion } from "./scrollRegion";

export type DrawerProps = {
  open: boolean;
  setIsOpen: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Icon controls shown beside the close button, such as a panel-wide action. */
  headerActions?: ReactNode;
  /** Pinned below the scrolling body — a summary and the primary actions. */
  footer?: ReactNode;
  panelClassName?: string;
  bodyClassName?: string;
};

// Matches the 200ms drawer-out and fade-out animations in the brand theme.
const EXIT_MS = 200;

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
  headerActions,
  footer,
  panelClassName,
  bodyClassName,
}: DrawerProps) => {
  // Both slides are plain CSS animations, and the panel stays mounted for the
  // exit on a timer of our own. Headless UI's tracked transitions (both
  // `transition` props and `Transition`) left the panel stuck on screen when
  // it was closed mid-slide; a timer always finishes.
  const [rendered, setRendered] = useState(open);
  if (open && !rendered) setRendered(true);
  const closing = rendered && !open;

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setRendered(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);

  return (
    // Reduced motion skips the exit animation, so hide the closing panel at once.
    <Dialog
      open={rendered}
      onClose={setIsOpen}
      className={`relative z-50 ${closing ? "motion-reduce:hidden" : ""}`}
    >
      <DialogBackdrop
        className={`fixed inset-0 bg-black/65 backdrop-blur-sm dark:bg-black/80 ${closing ? "motion-safe:animate-fade-out" : "motion-safe:animate-fade-in"}`}
      />
      {/* Clip, not hidden: a hidden overflow is still a scroll container, and
          focusing the close button while the panel sits off-screen scrolled it
          into view, cancelling the slide-in. */}
      <div className="fixed inset-0 flex justify-end overflow-clip">
        <DialogPanel
          className={`flex h-full w-full max-w-md flex-col border-l border-black/15 bg-white pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-[0_24px_80px_rgba(0,0,0,0.35)] will-change-transform dark:border-white/20 dark:bg-[#181818] ${closing ? "pointer-events-none motion-safe:animate-drawer-out" : "motion-safe:animate-drawer-in"} ${panelClassName ?? ""}`}
        >
          <EditorHeader
            title={title}
            description={description}
            titleAs={DialogTitle}
            descriptionAs={DialogDescription}
            action={
              <div className="flex shrink-0 items-center gap-2">
                {headerActions}
                {/* Opening focus stays on close, not on whatever action sits first. */}
                <IconButton
                  label="Close panel"
                  data-autofocus
                  onClick={() => setIsOpen(false)}
                >
                  <Close className="h-5 w-5" />
                </IconButton>
              </div>
            }
          />
          <ScrollRegion contentClassName={bodyClassName}>
            {children}
          </ScrollRegion>
          {footer && (
            <div className="shrink-0 border-t border-black/10 px-6 py-4 dark:border-white/10">
              {footer}
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export { Drawer };
