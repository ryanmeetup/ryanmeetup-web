"use client";

import {
  Dialog,
  DialogDescription,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { MdClose as Close, MdKeyboardArrowDown } from "react-icons/md";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEventHandler, ReactNode } from "react";
import { EditorFooter, EditorHeader } from "./editorChrome";
import { IconButton } from "./IconButton";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

export type ModalProps = {
  open: boolean;
  setIsOpen: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  closable?: boolean;
  /**
   * Let a click on the dimmed area dismiss the dialog. Off by default so a
   * stray click can't discard a half-filled form: closing then takes an
   * explicit cancel or close. Opt in for read-only dialogs like image viewers.
   */
  dismissOnOutsideClick?: boolean;
  /**
   * The primary button group, right-aligned in the footer. Pass `ModalActions`
   * for the standard cancel/confirm pair.
   */
  actions?: ReactNode;
  /** Left-aligned footer actions — destructive or secondary escapes. */
  supportingActions?: ReactNode;
  /** Footer content that sits above the button rows. */
  footerContent?: ReactNode;
  panelClassName?: string;
  /** Classes for the padded body, including full-height column layouts. */
  bodyClassName?: string;
  maxHeight?: string;
  /** An exact width, for the rare panel the `size` scale has no rung for. */
  maxWidth?: string;
  size?: ModalSize;
  formId?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
};

const overlayStyles =
  "fixed inset-0 flex w-screen items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]";

const sizeStyles: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
  "2xl": "max-w-7xl",
  full: "max-w-[calc(100vw-2rem)]",
};

const Modal = ({
  open,
  setIsOpen,
  title,
  description,
  children,
  closable = true,
  dismissOnOutsideClick = false,
  actions,
  supportingActions,
  footerContent,
  panelClassName,
  bodyClassName,
  maxHeight,
  maxWidth,
  size = "md",
  formId,
  onSubmit,
}: ModalProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    canScrollUp: false,
    canScrollDown: false,
  });

  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current;

    if (!container) return;

    const scrollBuffer = 2;
    setScrollState({
      canScrollUp: container.scrollTop > scrollBuffer,
      canScrollDown:
        container.scrollTop + container.clientHeight <
        container.scrollHeight - scrollBuffer,
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    const container = scrollContainerRef.current;
    const content = scrollContentRef.current;

    if (!container || !content) return;

    updateScrollState();

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(container);
    resizeObserver.observe(content);

    return () => resizeObserver.disconnect();
  }, [open, updateScrollState]);

  const cardStyle =
    maxHeight || maxWidth
      ? {
          ...(maxHeight ? { maxHeight } : {}),
          ...(maxWidth ? { maxWidth } : {}),
        }
      : undefined;
  const cardClassName = `mx-auto flex w-full min-h-0 flex-col ${maxWidth ? "" : sizeStyles[size]} ${maxHeight ? "" : "max-h-[min(42rem,calc(100dvh-max(1rem,env(safe-area-inset-top))-max(1rem,env(safe-area-inset-bottom))))] sm:max-h-[calc(100dvh-max(1rem,env(safe-area-inset-top))-max(1rem,env(safe-area-inset-bottom)))]"} overflow-hidden rounded-2xl border border-black/15 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.35)] ring-1 ring-black/5 dark:border-white/20 dark:bg-[#181818] dark:shadow-[0_28px_100px_rgba(0,0,0,0.85)] dark:ring-white/10 ${panelClassName ?? ""}`;

  const cardContent = (
    <>
      <EditorHeader
        title={title}
        description={description}
        titleAs={DialogTitle}
        descriptionAs={DialogDescription}
        action={
          closable && (
            <IconButton label="Close dialog" onClick={() => setIsOpen(false)}>
              <Close className="h-5 w-5" />
            </IconButton>
          )
        }
      />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          ref={scrollContainerRef}
          onScroll={updateScrollState}
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
        >
          <div ref={scrollContentRef} className={`p-6 ${bodyClassName ?? ""}`}>
            {children}
          </div>
        </div>
        {scrollState.canScrollUp && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-black/15 to-transparent dark:from-black/45"
          />
        )}
        {scrollState.canScrollDown && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-16 items-end justify-center bg-gradient-to-t from-white via-white/90 to-transparent pb-2 dark:from-[#181818] dark:via-[#181818]/90"
          >
            <span className="flex items-center gap-1 rounded-full border border-black/10 bg-white/95 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-black/65 shadow-sm dark:border-white/15 dark:bg-[#242424]/95 dark:text-white/70">
              Scroll for more
              <MdKeyboardArrowDown className="h-4 w-4" />
            </span>
          </div>
        )}
      </div>
      <EditorFooter
        actions={actions}
        supportingActions={supportingActions}
        footerContent={footerContent}
      />
    </>
  );

  /**
   * Headless UI dismisses on a click landing outside `DialogPanel`, so the
   * panel is the card only when outside clicks should dismiss. Otherwise the
   * panel is the full-screen overlay and no click can ever land outside it —
   * Escape and the close/cancel buttons stay the only ways out.
   */
  const card = dismissOnOutsideClick ? (
    <DialogPanel
      as={formId ? "form" : "div"}
      id={formId}
      onSubmit={onSubmit}
      style={cardStyle}
      className={cardClassName}
    >
      {cardContent}
    </DialogPanel>
  ) : formId ? (
    <form
      id={formId}
      onSubmit={onSubmit}
      style={cardStyle}
      className={cardClassName}
    >
      {cardContent}
    </form>
  ) : (
    <div style={cardStyle} className={cardClassName}>
      {cardContent}
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (closable) setIsOpen(false);
      }}
      className="relative z-50"
    >
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-sm dark:bg-black/80"
        aria-hidden="true"
      />
      {dismissOnOutsideClick ? (
        <div className={overlayStyles}>{card}</div>
      ) : (
        <DialogPanel className={overlayStyles}>{card}</DialogPanel>
      )}
    </Dialog>
  );
};

export { Modal };
