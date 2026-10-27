import { describe, expect, it } from "vitest";
import {
  indexGroupsByProfile,
  indexMembersByGroup,
} from "@/lib/access/access-selectors";
import type { AccessGroup } from "@/lib/access/access-types";

const group = (id: string, rank: number): AccessGroup => ({
  id,
  name: id,
  description: null,
  color: "#000000",
  created_by: "user",
  created_at: "",
  updated_at: "",
  kind: "tier",
  hierarchy_rank: rank,
  grants_global_content: false,
  calendar_access: false,
  guest: false,
  is_default: false,
});
describe("effective access selectors", () => {
  it("builds reusable membership indexes", () => {
    const groups = [group("alpha", 10), group("beta", 20)];
    const members = [
      {
        group_id: "beta",
        profile_id: "person",
        added_by: "user",
        created_at: "",
      },
      {
        group_id: "alpha",
        profile_id: "person",
        added_by: "user",
        created_at: "",
      },
    ];
    expect(indexMembersByGroup(members).get("alpha")).toHaveLength(1);
    expect(
      indexGroupsByProfile(groups, members)
        .get("person")
        ?.map(({ id }) => id),
    ).toEqual(["alpha", "beta"]);
  });
});
