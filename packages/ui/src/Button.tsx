// Components
import NextLink from "next/link";

// Types
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { Spinner } from "./Spinner";

export type ButtonLinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & {
  children: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  disabled?: boolean;
  href: string;
  newTab?: boolean;
  variant?: ButtonVariant;
  /** Compact by default; `field` matches shared form-control height. */
  size?: ButtonSize;
  fullWidth?: boolean;
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  variant?: ButtonVariant;
  /** Compact by default; `field` matches shared form-control height. */
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  loadingText?: ReactNode;
};

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "action"
  | "danger"
  | "success"
  | "outline"
  | "ghost";
export type ButtonSize = "xs" | "sm" | "field" | "md" | "lg";

const sizeStyles: Record<ButtonSize, string> = {
  xs: "px-3 py-1.5 text-[11px] tracking-[0.16em]",
  sm: "px-4 py-2 text-xs",
  field: "h-[42px] px-4 py-0 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm",
};

const getBaseClasses = (
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean,
) => {
  const base =
    "relative inline-flex items-center justify-center gap-2 rounded-lg font-semibold uppercase tracking-[0.2em] transition focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 group";

  const width = fullWidth ? "w-full" : "w-auto";

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      "border border-black/60 bg-black text-white shadow-lg hover:border-black/80 hover:bg-black/90 hover:-translate-y-0.5 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-white/90 dark:hover:text-black",
    secondary:
      "border border-black/20 bg-white/80 text-black hover:border-black/40 hover:bg-black/5 hover:shadow-sm dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:border-white/40 dark:hover:bg-white/10",
    action:
      "border border-zinc-700 bg-zinc-700 text-white shadow-md hover:-translate-y-0.5 hover:border-zinc-900 hover:bg-zinc-800 hover:shadow-lg focus:ring-zinc-500/30 dark:border-zinc-300 dark:bg-zinc-300 dark:text-black dark:hover:border-white dark:hover:bg-zinc-100 dark:hover:text-black dark:focus:ring-white/30",
    danger:
      "border border-red-700 bg-red-700 text-white shadow-md hover:-translate-y-0.5 hover:border-red-800 hover:bg-red-800 hover:shadow-lg focus:ring-red-500/30 dark:border-red-500 dark:bg-red-600 dark:text-white dark:hover:border-red-400 dark:hover:bg-red-500",
    // Green outline for an action that finishes something, such as completing
    // a task. Reserved for that meaning, like `danger` is for destruction.
    success:
      "border border-emerald-600 bg-emerald-50 text-emerald-800 shadow-md hover:-translate-y-0.5 hover:border-emerald-700 hover:bg-emerald-100 hover:shadow-lg focus:ring-emerald-500/30 motion-reduce:transform-none dark:border-emerald-400 dark:bg-emerald-400/10 dark:text-emerald-200 dark:hover:border-emerald-300 dark:hover:bg-emerald-400/20 dark:focus:ring-emerald-400/30",
    outline:
      "border border-black/60 bg-black/80 text-white hover:border-black/80 hover:bg-black/70 dark:border-white/20 dark:text-white dark:hover:border-white/40 dark:hover:bg-white/10",
    ghost:
      "text-black dark:text-white bg-transparent border-none shadow-none hover:text-black/70 dark:hover:text-white/70",
  };

  return `${base} ${sizeStyles[size]} ${variantStyles[variant]} ${width}`;
};

const ButtonContent = (props: {
  children: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}) => {
  const { children, leftIcon, rightIcon } = props;

  return (
    <>
      {leftIcon && <span className="text-base">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="text-base">{rightIcon}</span>}
    </>
  );
};

const ButtonLink = (props: ButtonLinkProps) => {
  const {
    children,
    className,
    leftIcon,
    rightIcon,
    disabled = false,
    href,
    newTab = false,
    download,
    variant = "primary",
    size = "sm",
    fullWidth = false,
    onClick,
    ...linkProps
  } = props;

  return (
    <NextLink
      className={`${getBaseClasses(variant, size, fullWidth)} ${
        disabled ? "pointer-events-none opacity-60" : ""
      } ${className ?? ""}`}
      href={href}
      target={newTab ? "_blank" : "_self"}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      download={download}
      onClick={onClick}
      rel={newTab ? "noopener noreferrer" : linkProps.rel}
      {...linkProps}
    >
      {variant === "primary" && !disabled && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-0.5 rounded-lg opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100 bg-[conic-gradient(from_180deg,_rgba(0,0,0,0.2),_rgba(0,0,0,0.05),_rgba(0,0,0,0.2))] dark:bg-[conic-gradient(from_180deg,_rgba(255,255,255,0.25),_rgba(255,255,255,0.05),_rgba(255,255,255,0.25))]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.2),_transparent_60%)]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100 ring-2 ring-black/30 dark:ring-white/30 animate-pulse"
          />
        </>
      )}
      <ButtonContent leftIcon={leftIcon} rightIcon={rightIcon}>
        {children}
      </ButtonContent>
    </NextLink>
  );
};

const Button = (props: ButtonProps) => {
  const {
    children,
    className,
    onClick,
    leftIcon,
    rightIcon,
    disabled = false,
    variant = "primary",
    size = "sm",
    fullWidth = false,
    loading = false,
    loadingText,
    type = "button",
    ...buttonProps
  } = props;

  const isDisabled = disabled || loading;

  return (
    <button
      className={`${getBaseClasses(variant, size, fullWidth)} ${
        isDisabled ? "opacity-60 cursor-not-allowed" : ""
      } ${className ?? ""}`}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      type={type}
      {...buttonProps}
    >
      {variant === "primary" && !isDisabled && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-0.5 rounded-lg opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100 bg-[conic-gradient(from_180deg,_rgba(0,0,0,0.2),_rgba(0,0,0,0.05),_rgba(0,0,0,0.2))] dark:bg-[conic-gradient(from_180deg,_rgba(255,255,255,0.25),_rgba(255,255,255,0.05),_rgba(255,255,255,0.25))]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.2),_transparent_60%)]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100 ring-2 ring-black/30 dark:ring-white/30 animate-pulse"
          />
        </>
      )}
      <ButtonContent
        leftIcon={loading ? <Spinner size={16} label="Loading" /> : leftIcon}
        rightIcon={loading ? undefined : rightIcon}
      >
        {loading && loadingText ? loadingText : children}
      </ButtonContent>
    </button>
  );
};

Button.Link = ButtonLink;

export { Button };
