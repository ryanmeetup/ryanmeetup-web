"use client";

import { Transition } from "@headlessui/react";
import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type TooltipPlacement = "top" | "right" | "bottom" | "left";

export type TooltipProps = {
  children: ReactElement<{ "aria-describedby"?: string }>;
  content: ReactNode;
  className?: string;
  disabled?: boolean;
  placement?: TooltipPlacement;
  triggerClassName?: string;
};

type TooltipPosition = {
  caretOffset: number;
  left: number;
  placement: TooltipPlacement;
  top: number;
};

const oppositePlacement: Record<TooltipPlacement, TooltipPlacement> = {
  top: "bottom",
  right: "left",
  bottom: "top",
  left: "right",
};

const caretStyles: Record<TooltipPlacement, string> = {
  top: "top-full -translate-x-1/2 -translate-y-1/2",
  right: "right-full translate-x-1/2 -translate-y-1/2",
  bottom: "bottom-full -translate-x-1/2 translate-y-1/2",
  left: "left-full -translate-x-1/2 -translate-y-1/2",
};

const Tooltip = ({
  children,
  content,
  className,
  disabled = false,
  placement = "top",
  triggerClassName,
}: TooltipProps) => {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  if (disabled && open) setOpen(false);

  const closeTooltip = () => {
    setOpen(false);
    setPosition(null);
  };

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const triggerRect = trigger.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    const gap = 8;
    const padding = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spaces: Record<TooltipPlacement, number> = {
      top: triggerRect.top - padding,
      right: viewportWidth - triggerRect.right - padding,
      bottom: viewportHeight - triggerRect.bottom - padding,
      left: triggerRect.left - padding,
    };
    const required: Record<TooltipPlacement, number> = {
      top: tooltipHeight + gap,
      right: tooltipWidth + gap,
      bottom: tooltipHeight + gap,
      left: tooltipWidth + gap,
    };
    const remaining = (Object.keys(spaces) as TooltipPlacement[]).filter(
      (side) => side !== placement && side !== oppositePlacement[placement],
    );
    const candidates = [
      placement,
      oppositePlacement[placement],
      ...remaining.sort((a, b) => spaces[b] - spaces[a]),
    ];
    const resolvedPlacement =
      candidates.find((side) => spaces[side] >= required[side]) ??
      candidates.sort(
        (a, b) => spaces[b] - required[b] - (spaces[a] - required[a]),
      )[0];

    let top = 0;
    let left = 0;
    if (resolvedPlacement === "top") {
      top = triggerRect.top - tooltipHeight - gap;
      left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
    } else if (resolvedPlacement === "bottom") {
      top = triggerRect.bottom + gap;
      left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
    } else if (resolvedPlacement === "right") {
      top = triggerRect.top + triggerRect.height / 2 - tooltipHeight / 2;
      left = triggerRect.right + gap;
    } else {
      top = triggerRect.top + triggerRect.height / 2 - tooltipHeight / 2;
      left = triggerRect.left - tooltipWidth - gap;
    }

    top = Math.max(
      padding,
      Math.min(top, viewportHeight - tooltipHeight - padding),
    );
    left = Math.max(
      padding,
      Math.min(left, viewportWidth - tooltipWidth - padding),
    );

    const caretOffset =
      resolvedPlacement === "top" || resolvedPlacement === "bottom"
        ? Math.max(
            8,
            Math.min(
              triggerRect.left + triggerRect.width / 2 - left,
              tooltipWidth - 8,
            ),
          )
        : Math.max(
            8,
            Math.min(
              triggerRect.top + triggerRect.height / 2 - top,
              tooltipHeight - 8,
            ),
          );

    setPosition({ caretOffset, left, placement: resolvedPlacement, top });
  }, [placement]);

  useLayoutEffect(() => {
    if (!open || disabled) return;
    updatePosition();
    const animationFrame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [content, disabled, open, updatePosition]);

  const handleBlur = (event: FocusEvent<HTMLSpanElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  };

  const caretStyle: CSSProperties | undefined = position
    ? position.placement === "top" || position.placement === "bottom"
      ? { left: position.caretOffset }
      : { top: position.caretOffset }
    : undefined;

  const tooltip = (
    <Transition
      show={open}
      enter="transition duration-150 ease-out"
      enterFrom="scale-95 opacity-0"
      enterTo="scale-100 opacity-100"
      leave="transition duration-100 ease-in"
      leaveFrom="scale-100 opacity-100"
      leaveTo="scale-95 opacity-0"
    >
      <span
        ref={tooltipRef}
        id={id}
        role="tooltip"
        style={{
          left: position?.left ?? 0,
          top: position?.top ?? 0,
          visibility: position ? "visible" : "hidden",
        }}
        className={`pointer-events-none fixed z-[100] w-max max-w-64 rounded-md bg-black px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-lg dark:bg-white dark:text-black ${className ?? ""}`}
      >
        {content}
        {position && (
          <span
            aria-hidden
            style={caretStyle}
            className={`absolute h-2 w-2 rotate-45 bg-black dark:bg-white ${caretStyles[position.placement]}`}
          />
        )}
      </span>
    </Transition>
  );

  return (
    <span
      ref={triggerRef}
      className={`relative inline-flex ${triggerClassName ?? ""}`}
      onFocus={(event) => {
        if (!disabled && event.target.matches(":focus-visible")) setOpen(true);
      }}
      onBlur={handleBlur}
      onClick={closeTooltip}
      onMouseEnter={() => {
        if (!disabled) setOpen(true);
      }}
      onMouseLeave={closeTooltip}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      {/* Children.map resolves streamed Server Component children before we read props. */}
      {Children.map(children, (child) =>
        isValidElement<{ "aria-describedby"?: string }>(child)
          ? cloneElement(child, {
              "aria-describedby":
                [
                  child.props["aria-describedby"],
                  open && !disabled ? id : undefined,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined,
            })
          : child,
      )}
      {disabled || typeof document === "undefined"
        ? null
        : createPortal(tooltip, document.body)}
    </span>
  );
};

export { Tooltip };
