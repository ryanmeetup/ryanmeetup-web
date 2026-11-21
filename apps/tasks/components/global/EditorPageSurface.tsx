"use client";

import { usePathname } from "next/navigation";
import type { FormEventHandler, ReactNode } from "react";
import {
  Breadcrumbs,
  Card,
  footerActionGroup,
  type ModalSize,
} from "@ryanmeetup/ui";
import { PageHeader } from "./PageHeader";

/**
 * The page column, on the same rungs `Modal` sizes its card by — shifted one
 * rung wider, because a page has no dimmed backdrop to leave room for and no
 * card edge to sit inside.
 *
 * Sharing the scale is what makes the widen-on-expand gesture survive the trip
 * from dialog to route: an editor whose supporting details open beside the form
 * already raises its `size`, and here that widens the whole column instead of
 * cramming a two-column grid into a fixed one.
 */
/** Editors use the fixed rungs; `fit` belongs to content-sized dialogs like a photo viewer. */
export type EditorSize = Exclude<ModalSize, "fit">;

const pageWidths: Record<EditorSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  "2xl": "max-w-7xl",
  full: "max-w-none",
};

export type EditorCrumb = {
  href: string;
  title: string;
  icon?: ReactNode;
};

export type EditorPageSurfaceProps = {
  /**
   * The screens this editor sits under, outermost first. A list rather than a
   * single parent because an editor can be more than one level deep — the task
   * editor sits under the board *and* under the task it edits.
   *
   * These are the canonical hrefs, not wherever the author happened to arrive
   * from. Cancel is the control that retraces the author's own steps.
   */
  parents: readonly EditorCrumb[];
  /** The current crumb: the record being created or edited. */
  crumb: { title: string; icon?: ReactNode };
  title: ReactNode;
  description?: ReactNode;
  /** The form body, laid out inside the page's card. */
  children: ReactNode;
  /** The commit/dismiss pair, right-aligned in the primary card's action row. */
  actions?: ReactNode;
  /** Left-aligned destructive or secondary escapes. */
  supportingActions?: ReactNode;
  /** Content that sits above the action row. */
  footerContent?: ReactNode;
  /**
   * The column width, on the `pageWidths` scale. Defaults to `lg`; raise it the
   * way the dialog does when the form grows a second column.
   */
  size?: EditorSize;
  /** Omit when the children carry their own `<form>`. */
  formId?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  className?: string;
};

/**
 * A create/edit route laid out as a workspace page: the breadcrumb trail back
 * to its list, the same `PageHeader` every other screen uses, and the form in
 * cards that scroll with the document.
 *
 * This is deliberately not a dialog moved onto a route. A dialog announces
 * itself as a layer over something else — it dims a backdrop, caps its own
 * height, scrolls inside a card, pins its actions, and offers a close control
 * whose only job is to reveal what it covered. A route covers nothing. It is
 * the screen, so it is titled like one, sits in the trail like one, and lets
 * the browser scroll it like one, and the actions travel with the fields they
 * commit instead of floating above them.
 *
 * `components/contacts/ContactEditor.tsx` is the reference composition and
 * renders through this surface unchanged.
 */
export function EditorPageSurface({
  parents,
  crumb,
  title,
  description,
  children,
  actions,
  supportingActions,
  footerContent,
  size = "lg",
  formId,
  onSubmit,
  className,
}: EditorPageSurfaceProps) {
  const pathname = usePathname();

  const body = (
    <Card size="lg">
      {children}
      {footerContent}
      {(supportingActions || actions) && (
        <div className="mt-6 flex flex-col gap-3 border-t border-black/10 pt-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          {supportingActions && (
            <div className="flex flex-wrap items-center gap-2">
              {supportingActions}
            </div>
          )}
          {actions && (
            <div
              className={`${footerActionGroup} flex-col-reverse sm:ml-auto sm:justify-end`}
            >
              {actions}
            </div>
          )}
        </div>
      )}
    </Card>
  );

  return (
    <div
      // The suite measures this column to check that it still widens with
      // `size`; the classes it does that through are not a stable handle.
      data-editor-page=""
      className={`mx-auto w-full min-w-0 space-y-6 ${pageWidths[size]} transition-[max-width] duration-300 ease-out motion-reduce:transition-none ${className ?? ""}`}
    >
      <div className="min-w-0 space-y-2">
        <Breadcrumbs
          variant="compact"
          crumbs={[
            ...parents.map((parent) => ({ ...parent, current: false })),
            { current: true, href: pathname, ...crumb },
          ]}
        />
        <PageHeader title={title} description={description} />
      </div>
      {formId ? (
        <form id={formId} onSubmit={onSubmit} className="space-y-6">
          {body}
        </form>
      ) : (
        <div className="space-y-6">{body}</div>
      )}
    </div>
  );
}
