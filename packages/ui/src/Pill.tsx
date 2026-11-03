// Types
import type { CSSProperties, ReactNode } from "react";

export type PillProps = {
  children: ReactNode;
  className?: string;
  variant?: "default" | "subtle" | "overlay" | "neutral" | "code" | "success";
  size?: "sm" | "md";
  style?: CSSProperties;
};

const Pill = (props: PillProps) => {
  const {
    children,
    className,
    variant = "default",
    size = "md",
    style,
  } = props;

  const baseStyles =
    "inline-flex items-center justify-center rounded-full border uppercase";
  const variantStyles = {
    default:
      "border-black/20 bg-white/90 px-4 py-1 font-semibold tracking-[0.3em] text-black/80 shadow-sm dark:border-white/25 dark:bg-white/15 dark:text-white/85",
    subtle:
      "border-black/10 bg-white/80 px-3 py-1 font-normal tracking-[0.2em] text-black/70 shadow-none dark:border-white/15 dark:bg-white/5 dark:text-white/70",
    overlay: "border-white/30 bg-black/60 text-white",
    neutral:
      "border-black/10 bg-white/80 text-black/70 dark:border-white/10 dark:bg-white/10 dark:text-white/70",
    // Green for a status that just went right, like a cart's newest line.
    success:
      "gap-1.5 border-emerald-600 bg-emerald-50 font-semibold text-emerald-800 shadow-sm dark:border-emerald-400 dark:bg-emerald-400/15 dark:text-emerald-200",
    code: "rounded-md border-black/10 bg-black/[0.045] font-mono font-medium !normal-case !tracking-normal text-black/75 shadow-none dark:border-white/10 dark:bg-white/[0.07] dark:text-white/75",
  };
  const sizeStyles = {
    sm: "px-3 py-1 text-[10px] tracking-[0.35em]",
    md: "px-3 py-1 text-xs font-semibold tracking-[0.3em]",
  };

  return (
    <span
      style={style}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className ?? ""}`}
    >
      {children}
    </span>
  );
};

export { Pill };
