import clsx from "clsx";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { Heading, Text } from "@ryanmeetup/ui";

/*
  Anything riding alongside the title. `align-middle` centers a box on the
  baseline plus half the *x-height*, but the title is display type whose
  capitals reach well above that, so a star or badge parked there reads low
  against them. The nudge lifts it the rest of the way to the cap-height
  centre, and scales with the heading because it is expressed in `em`.
*/
const inlineWithTitle = "inline-flex -translate-y-[0.11em] align-middle";

/**
 * The standard top of a workspace screen: an optional kicker, the page icon and
 * title, an optional trailing badge, the one-line description, and any actions
 * that belong beside the title.
 *
 * Every page uses this rather than composing its own heading, so the icon
 * treatment, description tone, and action alignment stay identical across the
 * app and can be changed in one place.
 */
export function PageHeader({
  actions,
  badge,
  className,
  description,
  icon: Icon,
  kicker,
  title,
  titleActions,
}: {
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon?: IconType;
  kicker?: ReactNode;
  title: ReactNode;
  titleActions?: ReactNode;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      {/* `w-full` keeps the stacked mobile column from sizing to its widest
          child: `items-start` above makes that column shrink-to-fit, so a long
          unbroken title (a domain name, say) would set the column's width and
          carry the whole header off the right edge. */}
      <div className="w-full min-w-0 flex-1">
        {kicker && (
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/50 dark:text-white/50">
            {kicker}
          </p>
        )}
        {/* Inline flow, not a flex row: a flex item that has to shrink to the
            container's width leaves no room beside it, so the badge and title
            actions of a title long enough to wrap would be pushed onto a line
            of their own. Inline boxes ride along with the last word instead. */}
        <Heading
          size="h1"
          className={clsx(
            "wrap-anywhere text-2xl sm:text-4xl",
            kicker && "mt-2",
          )}
        >
          {/* Muted so the icon labels the page without competing with it. */}
          {Icon && (
            <Icon
              aria-hidden
              className={clsx(
                inlineWithTitle,
                "mr-2 text-black/40 dark:text-white/40",
              )}
            />
          )}
          {title}
          {badge && (
            <span className={clsx(inlineWithTitle, "ml-2")}>{badge}</span>
          )}
          {titleActions && (
            <span className={clsx(inlineWithTitle, "ml-1")}>
              {titleActions}
            </span>
          )}
        </Heading>
        {description && <Text className="mt-2 text-sm">{description}</Text>}
      </div>
      {/*
        `shrink-0` is load-bearing. The actions sit behind `sm:justify-end` at
        their own call sites, and a container that shrinks below its buttons
        overflows a justify-end row from the *left* — the buttons ride out over
        the description instead of the description wrapping short of them.
      */}
      {actions && <div className="w-full sm:w-auto sm:shrink-0">{actions}</div>}
    </div>
  );
}
