import clsx from "clsx";
import type { HTMLAttributes } from "react";

export type WordmarkProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** The display name, such as "RYAN" or "RYANCON". */
  name: string;
  /** A small line set beneath the name. */
  tagline?: string;
  /** Steps the name down below `sm` so a long name stays on one line. */
  compact?: boolean;
};

/**
 * The site name for a header. Renders spans rather than a heading so each
 * page keeps a single `<h1>` of its own; wrap it in the app's home link.
 */
const Wordmark = ({
  name,
  tagline,
  compact = false,
  className,
  ...props
}: WordmarkProps) => (
  <span
    {...props}
    className={clsx(
      "inline-grid w-fit text-black dark:text-white",
      tagline && "gap-1",
      className,
    )}
  >
    <span
      className={clsx(
        "font-cooper tracking-wider sm:text-3xl",
        compact ? "text-xl" : "text-2xl",
        tagline && "leading-none",
      )}
    >
      {name}
    </span>
    {tagline && (
      <span className="text-[10px] font-bold uppercase leading-none tracking-[0.2em] text-black/70 dark:text-white/70">
        {tagline}
      </span>
    )}
  </span>
);

export { Wordmark };
