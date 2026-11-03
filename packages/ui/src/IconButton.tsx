import NextLink from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  ReactElement,
  ReactNode,
} from "react";
import { Tooltip } from "./Tooltip";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  label: string;
  size?: "sm" | "md";
  variant?: "subtle" | "overlay" | "plain" | "edit" | "archive" | "danger";
  tooltip?: ReactNode | false;
  tooltipPlacement?: "top" | "right" | "bottom" | "left";
  tooltipTriggerClassName?: string;
};

export type IconButtonLinkProps = Omit<ComponentProps<typeof NextLink>, "href"> &
  Pick<
    IconButtonProps,
    | "children"
    | "label"
    | "size"
    | "tooltip"
    | "tooltipPlacement"
    | "tooltipTriggerClassName"
    | "variant"
  > & {
    href: string;
  };

const sizeStyles = { sm: "h-8 w-8", md: "h-10 w-10" };
const variantStyles = {
  subtle:
    "rounded-full border border-black/10 text-black hover:bg-black/5 focus-visible:ring-black/30 dark:border-white/10 dark:text-white dark:hover:bg-white/10 dark:focus-visible:ring-white/30",
  overlay:
    "rounded-full border border-white/50 bg-black/70 text-white shadow-lg backdrop-blur hover:bg-black/85 focus-visible:ring-white/80",
  plain:
    "rounded text-black hover:scale-125 focus-visible:ring-black/30 dark:text-white dark:focus-visible:ring-white/30",
  edit:
    "rounded-full border border-blue-500/20 text-blue-600 hover:-translate-y-0.5 hover:border-blue-500/40 hover:bg-blue-50 hover:shadow-sm focus-visible:ring-blue-500/30 active:translate-y-0 motion-reduce:transform-none dark:border-blue-400/25 dark:text-blue-400 dark:hover:border-blue-400/50 dark:hover:bg-blue-950/40 dark:focus-visible:ring-blue-400/30",
  archive:
    "rounded-full border border-green-500/25 text-green-700 hover:-translate-y-0.5 hover:border-green-500/50 hover:bg-green-50 hover:shadow-sm focus-visible:ring-green-500/30 active:translate-y-0 motion-reduce:transform-none dark:border-green-400/25 dark:text-green-300 dark:hover:border-green-400/50 dark:hover:bg-green-950/40 dark:focus-visible:ring-green-400/30",
  danger:
    "rounded-full border border-red-500/20 text-red-600 hover:-translate-y-0.5 hover:border-red-500/40 hover:bg-red-50 hover:shadow-sm focus-visible:ring-red-500/30 active:translate-y-0 motion-reduce:transform-none dark:border-red-400/25 dark:text-red-400 dark:hover:border-red-400/50 dark:hover:bg-red-950/40 dark:focus-visible:ring-red-400/30",
};

/** IconButton's classes, for triggers another component renders, such as a menu button. */
export const getIconButtonClasses = (
  size: NonNullable<IconButtonProps["size"]>,
  variant: NonNullable<IconButtonProps["variant"]>,
  className?: string,
) =>
  `inline-flex shrink-0 items-center justify-center transition duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 ${sizeStyles[size]} ${variantStyles[variant]} ${className ?? ""}`;

const withTooltip = (
  control: ReactElement<{ "aria-describedby"?: string }>,
  {
    label,
    tooltip,
    tooltipPlacement = "top",
    tooltipTriggerClassName,
  }: Pick<
    IconButtonProps,
    "label" | "tooltip" | "tooltipPlacement" | "tooltipTriggerClassName"
  >,
) => {
  if (tooltip === false) return control;
  return (
    <Tooltip
      content={tooltip ?? label}
      placement={tooltipPlacement}
      triggerClassName={`shrink-0 ${tooltipTriggerClassName ?? ""}`}
    >
      {control}
    </Tooltip>
  );
};

const IconButton = ({
  children,
  className,
  label,
  size = "sm",
  tooltip,
  tooltipPlacement = "top",
  tooltipTriggerClassName,
  variant = "subtle",
  type = "button",
  ...buttonProps
}: IconButtonProps) => {
  const button = (
    <button
      {...buttonProps}
      type={type}
      aria-label={label}
      className={getIconButtonClasses(size, variant, className)}
    >
      {children}
    </button>
  );

  return withTooltip(button, {
    label,
    tooltip,
    tooltipPlacement,
    tooltipTriggerClassName,
  });
};

const IconButtonLink = ({
  children,
  className,
  href,
  label,
  size = "sm",
  tooltip,
  tooltipPlacement = "top",
  tooltipTriggerClassName,
  variant = "subtle",
  ...linkProps
}: IconButtonLinkProps) => {
  const link = (
    <NextLink
      {...linkProps}
      href={href}
      aria-label={label}
      className={getIconButtonClasses(size, variant, className)}
    >
      {children}
    </NextLink>
  );

  return withTooltip(link, {
    label,
    tooltip,
    tooltipPlacement,
    tooltipTriggerClassName,
  });
};

IconButton.Link = IconButtonLink;

export { IconButton };
