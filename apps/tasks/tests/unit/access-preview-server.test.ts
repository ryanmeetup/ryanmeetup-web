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
  it("leaves a page with no row open", () => {
    expect(accessibleAreasForPreview([], [], ["leads"], false)).toEqual([
      "notes",
      "contacts",
      "calendar",
      "ryd",
    ]);
  });

  it("closes a restricted page that names no group", () => {
    expect(accessibleAreasForPreview(areaRows, [], ["leads"], false)).toEqual([
      "notes",
      "ryd",
    ]);
  });

  it("opens a restricted page only to a selected group", () => {
    const grants = [
      { area: "contacts", group_id: "leads" },
      { area: "calendar", group_id: "managers" },
    ];

    expect(
      accessibleAreasForPreview(areaRows, grants, ["leads"], false),
    ).toEqual(["notes", "contacts", "ryd"]);
  });

  it("does not let workspace-wide work authority bypass page restrictions", () => {
    expect(accessibleAreasForPreview(areaRows, [], [], false)).toEqual([
      "notes",
      "ryd",
    ]);
  });

  it("lets app owners bypass page restrictions", () => {
    expect(accessibleAreasForPreview(areaRows, [], [], true)).toEqual([
      "notes",
      "contacts",
      "calendar",
      "ryd",
    ]);
  });
});
