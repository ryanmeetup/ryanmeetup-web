"use client";

import { Disclosure, DisclosureButton } from "@headlessui/react";
import { FaChevronDown as ChevronDown } from "react-icons/fa";
import { useRef, type ReactNode } from "react";
import { AnimatedDisclosurePanel } from "./AnimatedDisclosurePanel";

export type DisclosureCardProps = {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  iconClassName?: string;
  id?: string;
  actions?: ReactNode;
  actionsClassName?: string;
  description?: ReactNode;
  collapsible?: boolean;
  /**
   * Wrap the toggle in a heading element so the section keeps its place in
   * the page outline. A heading inside the button would lose its semantics,
   * so pass the title as plain text or a styled span, not a `Heading`.
   */
  heading?: "h2" | "h3" | "h4";
};

const DisclosureCard = ({
  summary,
  children,
  defaultOpen = false,
  className = "rounded-2xl border border-black/10 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5",
  buttonClassName = "flex w-full items-center justify-between gap-4 p-5 text-left",
  panelClassName = "px-5 pb-5",
  iconClassName = "h-4 w-4",
  id,
  actions,
  actionsClassName = "absolute right-0 top-1/2 -translate-y-1/2",
  description,
  collapsible = true,
  heading,
}: DisclosureCardProps) => {
  const Title = heading;
  const buttonRef = useRef<HTMLButtonElement>(null);

  if (!collapsible)
    return (
      <div className={className}>
        <div
          className={`relative ${actions ? "flex min-h-10 flex-col justify-center" : ""}`}
        >
          {Title ? (
            <Title className={buttonClassName}>
              <span className="min-w-0 flex-1">{summary}</span>
            </Title>
          ) : (
            <div className={buttonClassName}>
              <span className="min-w-0 flex-1">{summary}</span>
            </div>
          )}
          {description && <div className="-mt-1">{description}</div>}
          {actions && (
            <div className={actionsClassName}>{actions}</div>
          )}
        </div>
        <div>{children}</div>
      </div>
    );

  const toggle = (open: boolean) => (
    <DisclosureButton
      ref={buttonRef}
      id={id}
      className={`cursor-pointer ${buttonClassName}`}
    >
      <span className="min-w-0 flex-1">{summary}</span>
      <ChevronDown
        className={`${iconClassName} shrink-0 transition-transform duration-200 ${open ? "-rotate-180" : ""}`}
      />
    </DisclosureButton>
  );

  return (
    <Disclosure as="div" className={className} defaultOpen={defaultOpen}>
      {({ open }) => (
        <>
          <div
            className={`relative ${actions ? "flex min-h-10 flex-col justify-center" : ""}`}
            onClick={(event) => {
              if (
                actions &&
                !open &&
                !buttonRef.current?.contains(event.target as Node)
              )
                buttonRef.current?.click();
            }}
          >
            {Title ? <Title className="m-0">{toggle(open)}</Title> : toggle(open)}
            {description && <div className="-mt-1">{description}</div>}
            {actions && (
            <div className={actionsClassName}>{actions}</div>
          )}
          </div>
          <AnimatedDisclosurePanel open={open} className={panelClassName}>
            {children}
          </AnimatedDisclosurePanel>
        </>
      )}
    </Disclosure>
  );
};

export { DisclosureCard };
