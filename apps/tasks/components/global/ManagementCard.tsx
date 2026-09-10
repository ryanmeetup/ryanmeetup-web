import type { ComponentProps, ReactNode } from "react";
import { Button, IconButton } from "@ryanmeetup/ui";

export type ManagementCardAction = {
  key: string;
  /** Short verb for the phone button: "Edit", "Archive", "Favorite". */
  label: string;
  /** Full sentence for the tooltip and the screen reader on both layouts. */
  description: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  iconVariant?: ComponentProps<typeof IconButton>["variant"];
  buttonVariant?: ComponentProps<typeof Button>["variant"];
  /** Applied to both layouts, for states like an active favorite. */
  iconClassName?: string;
  buttonClassName?: string;
  /** Route-versus-dialog visibility, per editor-routes.ts. */
  triggerClassName?: string;
};

export function ManagementCardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`block truncate text-lg font-semibold leading-tight ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

/*
    The phone buttons borrow the icon buttons' palette, so an action keeps its
    colour across the breakpoint: edit is blue, archive green, delete red.
    These override `secondary`, which paints its own border, text, and hover.
*/
const buttonToneClassName: Partial<
  Record<NonNullable<ManagementCardAction["iconVariant"]>, string>
> = {
  edit: "!border-blue-500/20 !text-blue-600 hover:!border-blue-500/40 hover:!bg-blue-50 dark:!border-blue-400/25 dark:!text-blue-400 dark:hover:!border-blue-400/50 dark:hover:!bg-blue-950/40",
  archive:
    "!border-green-500/25 !text-green-700 hover:!border-green-500/50 hover:!bg-green-50 dark:!border-green-400/25 dark:!text-green-300 dark:hover:!border-green-400/50 dark:hover:!bg-green-950/40",
  danger:
    "!border-red-500/20 !text-red-600 hover:!border-red-500/40 hover:!bg-red-50 dark:!border-red-400/25 dark:!text-red-400 dark:hover:!border-red-400/50 dark:hover:!bg-red-950/40",
};

/*
    Two layouts for one set of actions. A wide card carries them as icons
    beside the title; a phone gives the title the whole row and spells the
    same actions out as labelled buttons under the body, where they read as
    part of the card rather than as three unexplained glyphs.
*/
function ManagementCardActions({
  actions,
  layout,
}: {
  actions: ManagementCardAction[];
  layout: "icons" | "buttons";
}) {
  if (layout === "icons") {
    return (
      <div className="ml-auto hidden shrink-0 items-center gap-3 sm:flex">
        {actions.map((action) =>
          action.href ? (
            <IconButton.Link
              key={action.key}
              href={action.href}
              label={action.description}
              variant={action.iconVariant}
              className={action.iconClassName}
              tooltipTriggerClassName={action.triggerClassName}
            >
              {action.icon}
            </IconButton.Link>
          ) : (
            <IconButton
              key={action.key}
              label={action.description}
              variant={action.iconVariant}
              className={action.iconClassName}
              disabled={action.disabled}
              onClick={action.onClick}
              tooltipTriggerClassName={action.triggerClassName}
            >
              {action.icon}
            </IconButton>
          ),
        )}
      </div>
    );
  }

  /*
      Two to a row, and a lone last button stretches across. Flex rather than
      a two-column grid because a hidden trigger — the route-versus-dialog
      pair mounts both halves — must not leave an empty cell behind.
  */
  const cell = "min-w-[calc(50%-0.25rem)] flex-1";
  return (
    <div className="mt-3 flex flex-wrap gap-2 sm:hidden">
      {actions.map((action) => {
        const tone = action.iconVariant
          ? (buttonToneClassName[action.iconVariant] ?? "")
          : "";
        const className = `${cell} ${tone} ${action.triggerClassName ?? ""} ${action.buttonClassName ?? ""}`;
        return action.href ? (
          <Button.Link
            key={action.key}
            href={action.href}
            variant={action.buttonVariant ?? "secondary"}
            fullWidth
            leftIcon={action.icon}
            aria-label={action.description}
            className={className}
          >
            {action.label}
          </Button.Link>
        ) : (
          <Button
            key={action.key}
            variant={action.buttonVariant ?? "secondary"}
            fullWidth
            leftIcon={action.icon}
            aria-label={action.description}
            disabled={action.disabled}
            onClick={action.onClick}
            className={className}
          >
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}

export function ManagementCard({
  actions = [],
  body,
  children,
  className,
  footer,
  footerClassName = "justify-end",
}: {
  actions?: ManagementCardAction[];
  body?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  footerClassName?: string;
}) {
  return (
    <div
      className={`flex h-full flex-col rounded-xl border border-black/15 bg-black/[0.035] px-4 py-3 shadow-sm shadow-black/5 dark:border-white/10 dark:bg-white/[0.025] dark:shadow-none ${className ?? ""}`}
    >
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {children}
          {actions.length > 0 && (
            <ManagementCardActions actions={actions} layout="icons" />
          )}
        </div>
        {body && <div className="mt-2 min-w-0">{body}</div>}
        {actions.length > 0 && (
          <ManagementCardActions actions={actions} layout="buttons" />
        )}
      </div>
      {footer && (
        <div
          className={`mt-3 flex min-w-0 items-center gap-3 border-t border-black/10 pt-3 dark:border-white/10 ${footerClassName}`}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
