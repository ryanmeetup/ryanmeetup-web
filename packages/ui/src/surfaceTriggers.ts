/**
 * Class names for a trigger pair: an anchor to an editor's dedicated route on
 * a phone, and a control that opens the same editor as a dialog from `sm` up.
 * Render both halves; the breakpoint, not JavaScript, decides which one shows,
 * so there's no hydration branch and no flash of the wrong surface.
 *
 * The dialog half hides with `max-sm:hidden` rather than a plain `hidden`.
 * Tailwind v4 emits `.hidden` before `.inline-flex`, so on `Button`,
 * `Button.Link`, or `IconButton` (all `inline-flex`) a plain `hidden` never
 * takes effect. A media-query variant is emitted later and wins.
 *
 * On `IconButton`, pass these to `tooltipTriggerClassName` so the tooltip
 * wrapper leaves the row too, rather than an empty flex item.
 */
export const surfaceTriggerClassNames = {
  /** On the anchor to the route: shown below `sm`. */
  route: "sm:hidden",
  /** On the control that opens the dialog: shown from `sm` up. */
  dialog: "max-sm:hidden sm:inline-flex",
} as const;
