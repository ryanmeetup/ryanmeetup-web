import { describe, expect, it } from "vitest";
import {
  buildAccessGroupOverview,
  buildAccessGroupOverviews,
  effectiveMembershipGroupIds,
  inheritedGroupIds,
} from "@/lib/access/access-overview";
import type { AccessGroup } from "@/lib/access/access-types";

const group = (
  id: string,
  rank: number,
  overrides: Partial<AccessGroup> = {},
): AccessGroup => ({
  id,
  name: id,
  description: null,
  color: "#000000",
  created_by: "owner",
  created_at: "",
  updated_at: "",
  kind: "tier",
  hierarchy_rank: rank,
  grants_global_content: false,
  calendar_access: false,
  is_default: false,
  ...overrides,
});

describe("access group explanations", () => {
  it("uses the same lower-tier inheritance shape as database access", () => {
    const groups = [group("base", 0), group("lead", 10), group("exec", 20)];
    expect(inheritedGroupIds(groups[1], groups)).toEqual(["base", "lead"]);
    expect(
      inheritedGroupIds(
        group("team", 0, { kind: "team", hierarchy_rank: null }),
        groups,
      ),
    ).toEqual(["team"]);
    expect(effectiveMembershipGroupIds(["lead"], groups)).toEqual([
      "base",
      "lead",
    ]);
  });

  it("names open, direct, inherited, and workspace-wide reasons", () => {
    const base = group("base", 0, { name: "Members" });
    const lead = group("lead", 10, { name: "Leads", calendar_access: true });
    const overview = buildAccessGroupOverview({
      group: lead,
      groups: [base, lead],
      projects: [
        { id: "open", name: "Open", access_mode: "open" },
        { id: "inherited", name: "Inherited", access_mode: "restricted" },
      ],
      categories: [{ id: "direct", name: "Direct", access_mode: "restricted" }],
      projectGrants: [{ resourceId: "inherited", groupId: "base" }],
      categoryGrants: [{ resourceId: "direct", groupId: "lead" }],
      areaAccess: [{ area: "notes", accessMode: "restricted" }],
      areaGrants: [{ area: "notes", groupId: "base" }],
    });

    expect(overview.projects.map(({ reason }) => reason)).toEqual([
      "Open to the workspace",
      "Inherited from Members",
    ]);
    expect(overview.categories[0].reason).toBe("Selected directly");
    expect(overview.pages.find(({ id }) => id === "notes")?.reason).toBe(
      "Inherited from Members",
    );
    expect(overview.calendarReason).toBe("Enabled directly for this group");

    const global = buildAccessGroupOverview({
      group: group("global", 100, { grants_global_content: true }),
      groups: [base, group("global", 100, { grants_global_content: true })],
      projects: [{ id: "private", name: "Private", access_mode: "owners" }],
      categories: [],
      projectGrants: [],
      categoryGrants: [],
      areaAccess: [],
      areaGrants: [],
    });
    expect(global.projects[0].reason).toBe("Workspace-wide manager access");
  });

  it("explains every group from one set of grants", () => {
    const base = group("base", 0, { name: "Members" });
    const lead = group("lead", 10, { name: "Leads" });
    const overviews = buildAccessGroupOverviews({
      groups: [base, lead],
      projects: [
        { id: "open", name: "Open", access_mode: "open" },
        { id: "leads", name: "Leads only", access_mode: "restricted" },
      ],
      categories: [],
      projectGrants: [{ resourceId: "leads", groupId: "lead" }],
      categoryGrants: [],
      areaAccess: [],
      areaGrants: [],
    });

    expect([...overviews.keys()]).toEqual(["base", "lead"]);
    expect(overviews.get("base")?.projects.map(({ id }) => id)).toEqual([
      "open",
    ]);
    expect(overviews.get("lead")?.projects.map(({ id }) => id)).toEqual([
      "open",
      "leads",
    ]);
    expect(overviews.get("base")?.projectCount).toBe(2);
  });

  it("lists what a group cannot open, with the rule that keeps it out", () => {
    const base = group("base", 0, { name: "Members" });
    const lead = group("lead", 10, { name: "Leads" });
    const overview = buildAccessGroupOverview({
      group: base,
      groups: [base, lead],
      projects: [
        { id: "open", name: "Open", access_mode: "open" },
        { id: "leads", name: "Leads only", access_mode: "restricted" },
        { id: "nobody", name: "Nobody yet", access_mode: "restricted" },
        { id: "private", name: "Private", access_mode: "owners" },
      ],
      categories: [],
      projectGrants: [{ resourceId: "leads", groupId: "lead" }],
      categoryGrants: [],
      areaAccess: [{ area: "notes", accessMode: "restricted" }],
      areaGrants: [{ area: "notes", groupId: "lead" }],
    });

    expect(overview.unavailableProjects).toEqual([
      { id: "leads", name: "Leads only", reason: "Restricted to other groups" },
      {
        id: "nobody",
        name: "Nobody yet",
        reason: "Restricted, with no groups selected",
      },
      { id: "private", name: "Private", reason: "Owners only" },
    ]);
    expect(
      overview.unavailablePages.map(({ id, reason }) => [id, reason]),
    ).toEqual([["notes", "Restricted to other groups"]]);
    expect(overview.projects.length + overview.unavailableProjects.length).toBe(
      overview.projectCount,
    );
  });
});
