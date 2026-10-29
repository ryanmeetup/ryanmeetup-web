import { describe, expect, it } from "vitest";
import {
  accessibleAreasForPreview,
  accessibleCategoryIdsForPreview,
  grantsCalendarAccessForPreview,
} from "@/lib/server/access-preview";

const categories = [
  { id: "general", access_mode: "open" as const },
  { id: "finance", access_mode: "restricted" as const },
  { id: "events", access_mode: "restricted" as const },
];

describe("access preview category visibility", () => {
  it("keeps a restricted category closed when it has no additional grants", () => {
    expect(
      accessibleCategoryIdsForPreview(categories, [], ["leads"], false),
    ).toEqual(["general"]);
  });

  it("opens a restricted category only to a specifically granted group", () => {
    const grants = [{ category_id: "events", group_id: "leads" }];

    expect(
      accessibleCategoryIdsForPreview(categories, grants, ["leads"], false),
    ).toEqual(["general", "events"]);
  });

  it("gives workspace-wide content authority every category", () => {
    expect(accessibleCategoryIdsForPreview(categories, [], [], true)).toEqual([
      "general",
      "finance",
      "events",
    ]);
  });
});

const groups = [
  { id: "managers", calendar_access: true },
  { id: "chapter-leads", calendar_access: false },
  { id: "events-team", calendar_access: null },
];

describe("access preview calendar visibility", () => {
  it("grants the workspace calendar through the group that allows it", () => {
    expect(grantsCalendarAccessForPreview(groups, ["managers"])).toBe(true);
  });

  it("inherits calendar access from a lower tier", () => {
    expect(
      grantsCalendarAccessForPreview(groups, ["chapter-leads", "managers"]),
    ).toBe(true);
  });

  it("hides the workspace calendar from groups without calendar access", () => {
    expect(
      grantsCalendarAccessForPreview(groups, ["chapter-leads", "events-team"]),
    ).toBe(false);
  });

  it("hides the workspace calendar from a group with no memberships", () => {
    expect(grantsCalendarAccessForPreview(groups, [])).toBe(false);
  });
});

const areaRows = [
  { area: "notes", access_mode: "open" as const },
  { area: "contacts", access_mode: "restricted" as const },
  { area: "calendar", access_mode: "restricted" as const },
];

describe("access preview page visibility", () => {
  it("leaves older unconfigured pages open and requires RY-D metadata", () => {
    expect(accessibleAreasForPreview([], [], ["leads"], false)).toEqual([
      "notes",
      "contacts",
      "calendar",
    ]);
  });

  it("closes a restricted page that names no group", () => {
    expect(accessibleAreasForPreview(areaRows, [], ["leads"], false)).toEqual([
      "notes",
    ]);
  });

  it("opens a restricted page only to a selected group", () => {
    const grants = [
      { area: "contacts", group_id: "leads" },
      { area: "calendar", group_id: "managers" },
    ];

    expect(
      accessibleAreasForPreview(areaRows, grants, ["leads"], false),
    ).toEqual(["notes", "contacts"]);
  });

  it("does not let workspace-wide work authority bypass page restrictions", () => {
    expect(accessibleAreasForPreview(areaRows, [], [], false)).toEqual([
      "notes",
    ]);
  });

  it("lets app owners bypass page restrictions", () => {
    expect(accessibleAreasForPreview(areaRows, [], [], true)).toEqual([
      "notes",
      "contacts",
      "calendar",
      "ryd",
      "ryd-settings",
    ]);
  });

  it("does not let an orphaned RY-D grant substitute for page metadata", () => {
    expect(
      accessibleAreasForPreview(
        [],
        [{ area: "ryd", group_id: "reviewers" }],
        ["reviewers"],
        false,
      ),
    ).not.toContain("ryd");
  });

  it("allows an explicitly open RY-D page", () => {
    expect(
      accessibleAreasForPreview(
        [{ area: "ryd", access_mode: "open" }],
        [],
        [],
        false,
      ),
    ).toContain("ryd");
  });

  it("requires a selected group on a restricted RY-D page", () => {
    const rows = [{ area: "ryd", access_mode: "restricted" as const }];
    const grants = [{ area: "ryd", group_id: "reviewers" }];
    expect(accessibleAreasForPreview(rows, grants, [], false)).not.toContain(
      "ryd",
    );
    expect(
      accessibleAreasForPreview(rows, grants, ["reviewers"], false),
    ).toContain("ryd");
  });

  it("opens RY-D Settings to workspace-wide tiers and no grant", () => {
    const rows = [{ area: "ryd-settings", access_mode: "restricted" as const }];
    const grants = [{ area: "ryd-settings", group_id: "reviewers" }];
    expect(
      accessibleAreasForPreview(rows, grants, ["reviewers"], false),
    ).not.toContain("ryd-settings");
    expect(accessibleAreasForPreview([], [], [], false, false, true)).toContain(
      "ryd-settings",
    );
  });

  it("retains app-owner access when RY-D metadata is missing", () => {
    expect(accessibleAreasForPreview([], [], [], true)).toContain("ryd");
  });

  it("keeps guests to the pages restricted to their groups", () => {
    const rows = [
      { area: "notes", access_mode: "open" as const },
      { area: "ryd", access_mode: "restricted" as const },
    ];
    const grants = [{ area: "ryd", group_id: "partners" }];
    expect(
      accessibleAreasForPreview(rows, grants, ["partners"], false, true),
    ).toEqual(["ryd"]);
    expect(
      accessibleAreasForPreview(rows, grants, ["leads"], false, true),
    ).toEqual([]);
  });
});

describe("access preview guest categories", () => {
  it("skips open categories for guests", () => {
    const categories = [
      { id: "open", access_mode: "open" as const },
      { id: "granted", access_mode: "restricted" as const },
    ];
    const grants = [{ category_id: "granted", group_id: "partners" }];
    expect(
      accessibleCategoryIdsForPreview(
        categories,
        grants,
        ["partners"],
        false,
        true,
      ),
    ).toEqual(["granted"]);
  });
});
