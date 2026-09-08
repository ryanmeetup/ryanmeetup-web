import NextLink from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

export type CardActionProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export type CardActionLinkProps = Omit<
  ComponentProps<typeof NextLink>,
  "href"
> & {
  children: ReactNode;
  href: string;
};

/** Pill sized to sit beside a header `IconButton` at `size="sm"`. */
const classes =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-black/10 px-3 text-xs font-semibold text-black transition duration-300 ease-in-out hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:text-white dark:hover:bg-white/10 dark:focus-visible:ring-white/30";

const CardActionLink = ({
  children,
  className,
  href,
  ...linkProps
}: CardActionLinkProps) => (
  <NextLink
    className={`${classes} ${className ?? ""}`}
    href={href}
    {...linkProps}
  >
    {children}
  </NextLink>
);

const CardAction = ({
  children,
  className,
  type = "button",
  ...buttonProps
}: CardActionProps) => (
  <button
    className={`${classes} ${className ?? ""}`}
    type={type}
    {...buttonProps}
  >
    {children}
  </button>
);

CardAction.Link = CardActionLink;

export { CardAction };
