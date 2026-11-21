"use client";

import { Modal } from "@ryanmeetup/ui";
import type { FormEventHandler, ReactNode } from "react";
import { EditorPageSurface, type EditorCrumb, type EditorSize } from "./EditorPageSurface";

type EditorSurfaceCommonProps = {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** The primary button group. Pass `ModalActions` on either surface. */
  actions?: ReactNode;
  /** Left-aligned destructive or secondary escapes. */
  supportingActions?: ReactNode;
  footerContent?: ReactNode;
  formId?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
};

/**
 * Dialog-shaped props. A page ignores most of them — it has no dimmed backdrop
 * to dismiss and no card edge to style. They stay assignable on both branches
 * because the editors that render into either surface compute them
 * unconditionally; making them a hard error on the page branch would only buy a
 * pile of ternaries at each call site.
 *
 * `size` is the exception, and it is honoured on both. It is not really a
 * dialog measurement but a statement about how much room the form needs, which
 * an editor already raises when its supporting details open beside the fields.
 * A page that dropped it kept a fixed column and crushed that second column
 * into it. `EditorPageSurface` reads it off its own, wider scale.
 */
type EditorDialogProps = {
  /**
   * Defaults to open: a surface that is rendered at all is usually shown.
   *
   * A page honours this as well as a dialog does. The editors that own both a
   * create and an edit surface keep them both mounted and close one with this
   * flag — `open={modal.open && !editingId}` — so a page that ignored it would
   * render the create form underneath the edit form.
   */
  open?: boolean;
  size?: EditorSize;
  maxHeight?: string;
  maxWidth?: string;
  panelClassName?: string;
  closable?: boolean;
};

export type EditorSurfaceProps = EditorSurfaceCommonProps &
  EditorDialogProps &
  (
    | { presentation?: "modal"; setOpen: (open: boolean) => void }
    | {
        presentation: "page";
        /** The screens this editor sits under, outermost first. */
        parents: readonly EditorCrumb[];
        /** The current crumb: the record being created or edited. */
        crumb: { title: string; icon?: ReactNode };
        setOpen?: (open: boolean) => void;
      }
  );

/**
 * One editor, two surfaces: the shared `Modal` on desktop and
 * `EditorPageSurface` on the dedicated route. Every Tier 1 editor renders
 * through this so the choice is made in exactly one place per editor, and so
 * the form body never has to know which surface it landed in.
 *
 * The two surfaces are genuinely different screens, not the same dialog with a
 * wider card. A dialog is a layer: it dims what it covers, caps its height,
 * scrolls inside itself, and closes. A route is the screen: it is titled with
 * `PageHeader`, sits in a breadcrumb trail, scrolls with the document, and
 * carries its commit actions alongside the fields they save. Only the form body
 * is shared. See `docs/MOBILE_EDITOR_SURFACES.md`.
 *
 * The dialog-shaped props — `panelClassName`, `closable` — are ignored on the
 * page branch; `size` is honoured on both. The page-shaped `parents`/`crumb`
 * are required on the page branch so no route can ship without its place in the
 * trail.
 */
export function EditorSurface(props: EditorSurfaceProps) {
  const {
    title,
    description,
    children,
    actions,
    supportingActions,
    footerContent,
    formId,
    onSubmit,
  } = props;

  if (props.presentation === "page") {
    if (props.open === false) return null;
    return (
      <EditorPageSurface
        parents={props.parents}
        crumb={props.crumb}
        title={title}
        description={description}
        actions={actions}
        supportingActions={supportingActions}
        footerContent={footerContent}
        size={props.size}
        formId={formId}
        onSubmit={onSubmit}
      >
        {children}
      </EditorPageSurface>
    );
  }

  return (
    <Modal
      open={props.open ?? true}
      setIsOpen={props.setOpen ?? (() => undefined)}
      title={title}
      description={description}
      size={props.size}
      maxHeight={props.maxHeight}
      maxWidth={props.maxWidth}
      panelClassName={props.panelClassName}
      closable={props.closable}
      actions={actions}
      supportingActions={supportingActions}
      footerContent={footerContent}
      formId={formId}
      onSubmit={onSubmit}
    >
      {children}
    </Modal>
  );
}
