import type { HTMLAttributes, ReactNode } from "react";
import { FiInbox } from "react-icons/fi";
import { Heading } from "./Heading";
import { Text } from "./Text";

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  message: string;
  description?: ReactNode;
  /** Decorative context icon; actions belong in the action slot. */
  icon?: ReactNode;
  action?: ReactNode;
  size?: "default" | "compact";
  variant?: "solid" | "dashed" | "plain";
};

const EmptyState = ({
  message,
  description,
  icon = <FiInbox />,
  action,
  size = "default",
  variant = "dashed",
  className,
  ...props
}: EmptyStateProps) => {
  const variantStyles = {
    solid:
      "rounded-2xl border border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/5",
    dashed:
      "rounded-2xl border border-dashed border-black/15 bg-black/[0.015] dark:border-white/15 dark:bg-white/[0.015]",
    plain: "",
  };
  const sizeStyles = {
    default: "min-h-72 px-6 py-10 sm:min-h-80 sm:px-8 sm:py-12",
    compact: "min-h-56 px-4 py-8",
  };

  return (
    <div
      {...props}
      className={`flex flex-col items-center justify-center text-center ${variantStyles[variant]} ${sizeStyles[size]} ${className ?? ""}`}
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
