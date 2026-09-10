/**
 * Which surface a person's create and edit forms open in.
 *
 * Every Tier 1 editor exists twice — as a dialog over the page you were on,
 * and as a dedicated route. `auto` lets the viewport decide, which is what
 * shipped and what most people want: a dialog has room on a desktop and does
 * not on a phone. The other two pin the surface at every width, for someone
 * who would rather always keep their place than always have the room, or the
 * reverse. See `docs/MOBILE_EDITOR_SURFACES.md`.
 */
export type EditorSurfacePreference = "auto" | "modal" | "page";

export const defaultEditorSurface: EditorSurfacePreference = "auto";

/**
 * The choices, in the order the profile form offers them. A list rather than a
 * union spelled out at each call site, so adding a surface is one entry here.
 */
export const editorSurfaceOptions: readonly {
  value: EditorSurfacePreference;
  label: string;
  description: string;
}[] = [
  {
    value: "auto",
    label: "Automatic",
    description:
      "Dialog on desktop; full page on phone. This is the default.",
  },
  {
    value: "modal",
    label: "Always a dialog",
    description: "Keep your place on the page behind the form, at any size.",
  },
  {
    value: "page",
    label: "Always a full page",
    description: "Open every form on its own route, with the whole screen.",
  },
];

export function isEditorSurface(
  value: unknown,
): value is EditorSurfacePreference {
  return editorSurfaceOptions.some((option) => option.value === value);
}

/**
 * A stored value that is missing or unrecognized reads as `auto`. The column is
 * `not null default 'auto'` with a check constraint, so this only covers a
 * profile shape assembled before the migration reached a deployment.
 */
export function editorSurface(value: unknown): EditorSurfacePreference {
  return isEditorSurface(value) ? value : defaultEditorSurface;
}
