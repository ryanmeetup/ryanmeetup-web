import { describe, expect, it } from "vitest";
import { profileSchema } from "@/lib/api-schema";
import { editorTriggers } from "@/components/global";
import {
  editorSurface,
  editorSurfaceOptions,
  isEditorSurface,
} from "@/lib/workspace/editor-surface";

const validProfileBody = {
  displayName: "Sam Rivera",
  taskDetailsOpenByDefault: false,
  assignNewTasksToSelf: false,
  editorSurface: "auto",
  calendarDefaultView: "all",
};

describe("editorSurface", () => {
  it("reads an unrecognized or missing value as the default", () => {
    // A profile assembled before the migration reaches a deployment has no
    // column to read, and the surface has to resolve to something.
    expect(editorSurface(undefined)).toBe("auto");
    expect(editorSurface("dialog")).toBe("auto");
    expect(isEditorSurface("modal")).toBe(true);
    expect(isEditorSurface("dialog")).toBe(false);
  });

  it("offers exactly the surfaces the column's check constraint allows", () => {
    expect(editorSurfaceOptions.map((option) => option.value)).toEqual([
      "auto",
      "modal",
      "page",
    ]);
  });
});

describe("editorTriggers", () => {
  it("mounts both halves on auto and lets a media query pick one", () => {
    // Both are rendered so the surface never depends on JavaScript measuring
    // the viewport: no matchMedia, no hydration branch.
    const triggers = editorTriggers("auto");
    expect(triggers.route).toBe(true);
    expect(triggers.dialog).toBe(true);
    expect(triggers.routeClassName).toBe("sm:hidden");
    expect(triggers.dialogClassName).toBe("max-sm:hidden sm:inline-flex");
  });

  it("drops the losing half — rather than hiding it — on a pinned surface", () => {
    // A plain `hidden` loses to the `inline-flex` in Button's base classes,
    // and a pinned preference has no breakpoint to hang a variant off.
    expect(editorTriggers("page")).toEqual({
      route: true,
      dialog: false,
      routeClassName: "",
      dialogClassName: "",
    });
    expect(editorTriggers("modal")).toEqual({
      route: false,
      dialog: true,
      routeClassName: "",
      dialogClassName: "",
    });
  });
});

describe("profileSchema", () => {
  it("carries the editor surface through", () => {
    expect(
      profileSchema({ ...validProfileBody, editorSurface: "page" }),
    ).toMatchObject({ editorSurface: "page" });
  });

  it("rejects a surface the column would refuse", () => {
    expect(
      profileSchema({ ...validProfileBody, editorSurface: "sidebar" }),
    ).toBeNull();
    expect(
      profileSchema({ ...validProfileBody, editorSurface: undefined }),
    ).toBeNull();
  });
});
