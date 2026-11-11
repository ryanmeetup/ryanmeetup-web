import clsx from "clsx";
import type { HTMLAttributes } from "react";

export type KickerProps = HTMLAttributes<HTMLParagraphElement>;

const Kicker = ({ className, ...props }: KickerProps) => (
  <p
    {...props}
    className={clsx(
      "text-xs font-semibold uppercase tracking-caps-wide text-black/70 dark:text-white/70",
      className,
    )}
  />
);

export { Kicker };
