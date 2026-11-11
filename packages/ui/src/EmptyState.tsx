import type { HTMLAttributes } from "react";

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  message: string;
  variant?: "solid" | "dashed" | "plain";
};

const EmptyState = ({
  message,
  variant = "dashed",
  className,
  ...props
}: EmptyStateProps) => {
  const variantStyles = {
    solid:
      "rounded-2xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5",
    dashed:
      "rounded-2xl border border-dashed border-black/20 p-6 dark:border-white/20",
    plain: "p-10",
  };

  return (
    <div
      {...props}
      className={`text-center ${variantStyles[variant]} ${className ?? ""}`}
    >
      <span className="text-sm uppercase tracking-caps text-black/70 dark:text-white/70">
        {message}
      </span>
    </div>
  );
};

export { EmptyState };
