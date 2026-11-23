import { describe, expect, it } from "vitest";
import { isReservedAccessGroupName } from "@/lib/access/access-groups";
import { accessGroupOperationSchema } from "@/lib/server/access-group-operations";

const team = (name: string) => ({
  action: "group.create",
  name,
  color: "#2563eb",
  kind: "team",
  hierarchyRank: null,
  grantsGlobalContent: false,
  calendarAccess: false,
  guest: false,
  description: null,
});

describe("reserved access group names", () => {
  it("reserves only names whose slug is the create route", () => {
    for (const name of ["New", "new", " NEW ", "new!"])
      expect(isReservedAccessGroupName(name)).toBe(true);
    for (const name of ["New team", "Newcomers", "Renew"])
      expect(isReservedAccessGroupName(name)).toBe(false);
  });

  it("refuses to create or rename a group into /admin/access/new", () => {
    expect(accessGroupOperationSchema(team("New"))).toBeNull();
    expect(
      accessGroupOperationSchema({
        ...team("new"),
        action: "group.update",
        id: "00000000-0000-4000-8000-000000000001",
      }),
    ).toBeNull();
    expect(accessGroupOperationSchema(team("New team"))).toMatchObject({
      action: "group.create",
      name: "New team",
    });
  });
});
