"use client";

import { Button, Tooltip, type ButtonProps } from "@ryanmeetup/ui";

/** Keep a disabled review action's explanation reachable by mouse and keyboard. */
export function RydReviewAction({
  tooltip,
  disabled,
  loading,
  className,
  children,
  ...props
}: ButtonProps & { children: string; tooltip: string }) {
  const unavailable = Boolean(disabled || loading);
  const button = (
    <Button
      {...props}
      disabled={disabled}
      loading={loading}
      className={`w-full sm:w-auto ${unavailable ? "pointer-events-none" : ""} ${className ?? ""}`}
    >
      {children}
    </Button>
  );

  return (
    <Tooltip content={tooltip} triggerClassName="w-full sm:w-auto">
      {unavailable ? (
        <span
          tabIndex={0}
          role="group"
          aria-label={`${children} unavailable`}
          aria-disabled
          className="inline-flex w-full cursor-not-allowed rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40 sm:w-auto"
        >
          {button}
        </span>
      ) : (
        button
      )}
    </Tooltip>
  );
}
