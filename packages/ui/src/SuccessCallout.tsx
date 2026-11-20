import { FiCheckCircle, FiX } from "react-icons/fi";
import type { ReactNode } from "react";

export type SuccessCalloutProps = {
  children?: ReactNode;
  className?: string;
  /** Optional headline; the children then read as supporting copy. */
  title?: ReactNode;
  /** Renders a close button that calls this. */
  onDismiss?: () => void;
  /** Accessible name for the close button. */
  dismissLabel?: string;
};

export function SuccessCallout({
  children,
  className,
  title,
  onDismiss,
  dismissLabel = "Dismiss message",
}: SuccessCalloutProps) {
  if (!children && !title) return null;
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm leading-relaxed text-emerald-800 dark:border-emerald-400/35 dark:bg-emerald-950/45 dark:text-emerald-100 ${title ? "" : "font-semibold"} ${className ?? ""}`}
    >
      <FiCheckCircle
        aria-hidden
        className={`shrink-0 ${title ? "mt-1 text-xl" : "mt-0.5 text-lg"}`}
      />
      <div className="min-w-0 flex-1 break-words">
        {title && <p className="font-cooper text-lg">{title}</p>}
        {children && <div className={title ? "mt-0.5" : undefined}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label={dismissLabel}
          onClick={onDismiss}
          className="-my-1 -mr-2 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-current opacity-75 transition hover:bg-emerald-500/15 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <FiX aria-hidden className="text-lg" />
        </button>
      )}
    </div>
  );
}
