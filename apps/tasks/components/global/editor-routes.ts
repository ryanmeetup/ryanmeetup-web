import { surfaceTriggerClassNames } from "@ryanmeetup/ui";
import {
  editorSurface,
  type EditorSurfacePreference,
} from "@/lib/workspace/editor-surface";

/**
 * The dedicated editor routes, and what decides when they are used. See
 * `docs/MOBILE_EDITOR_SURFACES.md`.
 *
 * The five heaviest editors — task, project, category, contact, and calendar
 * event — exist as both a dialog and a route. A trigger is therefore a pair:
 * an anchor to the route and a control that opens the dialog. Which of the two
 * a person gets is `editorTriggers`, below.
 *
 * Pair these two on the same trigger, always. A control that renders only the
 * route half leaves a dialog reader with no way in.
 *
 * The class names, and why the desktop half hides with `max-sm:hidden`
 * rather than a plain `hidden`, live with `surfaceTriggerClassNames` in
 * `@ryanmeetup/ui`. The same trap is why the pinned preferences drop a trigger
 * from the tree instead of hiding it: there is no breakpoint to hang a variant
 * off, and a plain `hidden` would not stick.
 */

export type EditorTriggers = {
  /** Render the anchor to the dedicated editor route. */
  route: boolean;
  /** Render the control that opens the dialog. */
  dialog: boolean;
  /** Goes on the route trigger. Empty unless the breakpoint is deciding. */
  routeClassName: string;
  /** Goes on the dialog trigger. Empty unless the breakpoint is deciding. */
  dialogClassName: string;
};

/**
 * Which halves of a trigger pair to render, for this profile's preference.
 *
 * On `auto` both halves are mounted and a media query hides one, so the choice
 * never depends on JavaScript measuring the viewport: no `matchMedia`, no
 * hydration branch, no flash of the wrong surface. On a pinned preference
 * there is no viewport question left to ask — the answer came from the profile
 * the server rendered — so the losing half is simply not rendered, which is
 * both cheaper and immune to the class-ordering trap described above.
 */
export function editorTriggers(preference: unknown): EditorTriggers {
  const surface: EditorSurfacePreference = editorSurface(preference);
  if (surface === "page")
    return {
      route: true,
      dialog: false,
      routeClassName: "",
      dialogClassName: "",
    };
  if (surface === "modal")
    return {
      route: false,
      dialog: true,
      routeClassName: "",
      dialogClassName: "",
    };
  return {
    route: true,
    dialog: true,
    routeClassName: surfaceTriggerClassNames.route,
    dialogClassName: surfaceTriggerClassNames.dialog,
  };
}

/**
 * The workspace shell padding an editor route passes as `contentClassName`.
 *
 * The same inset every other workspace screen uses, at every viewport: an
 * editor route is a page, so it is padded like one rather than bleeding to the
 * edge the way a dialog's card does.
 *
 * Padding only. How wide the column runs is the editor's own business and
 * changes while the form is open — `EditorPageSurface` centres and sizes it
 * from `size`, so a form that grows a second column widens the page instead of
 * squeezing into a fixed one.
 */
export const editorPageContentClassName = "p-4 sm:p-6 lg:p-8";
