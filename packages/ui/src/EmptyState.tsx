import type { HTMLAttributes, MouseEventHandler, ReactNode } from "react";
import { FiInbox } from "react-icons/fi";
import { Heading } from "./Heading";
import { Text } from "./Text";

export type EmptyStateProps = Omit<HTMLAttributes<HTMLDivElement>, "onClick"> & {
  message: string;
  description?: ReactNode;
  /** Decorative context icon; actions belong in the action slot. */
  icon?: ReactNode;
  action?: ReactNode;
  /**
   * `minimal` is a single line of quiet text in the surface, for dense slots
   * such as board columns. It ignores `icon`, `description`, and `action`;
   * pass `onClick` to make the whole surface the action instead.
   */
  size?: "default" | "compact" | "minimal";
  variant?: "solid" | "dashed" | "plain";
  /** Only honoured by `size="minimal"`, which then renders a button. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};

const surfaceStyles = {
  solid:
    "border border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/5",
  dashed:
    "border border-dashed border-black/15 bg-black/[0.015] dark:border-white/15 dark:bg-white/[0.015]",
  plain: "",
};

const minimalSurfaceStyles = {
  solid: surfaceStyles.solid,
  dashed: "border border-dashed border-black/15 dark:border-white/15",
  plain: "",
};

const EmptyState = ({
  message,
  description,
  icon = <FiInbox />,
  action,
  size = "default",
  variant = "dashed",
  onClick,
  disabled,
  className,
  ...props
}: EmptyStateProps) => {
  if (size === "minimal") {
    const base = `block w-full rounded-xl px-3 py-6 text-center text-xs sm:py-8 ${minimalSurfaceStyles[variant]} ${className ?? ""}`;
    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`${base} text-black/40 hover:border-black/30 hover:text-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:pointer-events-none dark:text-white/40 dark:hover:border-white/30 dark:hover:text-white/60 dark:focus-visible:ring-white/30`}
        >
          {message}
        </button>
      );
    }
    return (
      <div {...props} className={`${base} text-black/50 dark:text-white/50`}>
        {message}
      </div>
    );
  }

  const sizeStyles = {
    default: "min-h-72 px-6 py-10 sm:min-h-80 sm:px-8 sm:py-12",
    compact: "min-h-56 px-4 py-8",
  };

  return (
    <div
      {...props}
      className={`flex flex-col items-center justify-center text-center ${variant === "plain" ? "" : "rounded-2xl"} ${surfaceStyles[variant]} ${sizeStyles[size]} ${className ?? ""}`}
    >
      <div className="flex w-full max-w-md flex-col items-center">
        <div
          aria-hidden="true"
          className="relative mb-6 flex size-16 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-white text-2xl text-black/70 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/70"
        >
          <span className="pointer-events-none absolute -inset-2 rounded-3xl border border-black/5 dark:border-white/5" />
          {icon}
        </div>
        <Heading
          size="h3"
          variant="normal"
          bold
          className="text-base leading-snug tracking-normal sm:text-lg"
        >
          {message}
        </Heading>
        {description && (
          <Text className="mt-2 text-sm tracking-normal">{description}</Text>
        )}
        {action && (
          <div className="mt-6 flex w-full flex-col items-stretch justify-center gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {action}
          </div>
        )}
      </div>
    </div>
  );
};

export { EmptyState };
