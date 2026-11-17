import { expect, test } from "@playwright/test";
import { splitPolicyLastUpdated, toIsoDate } from "../lib/policies";

test("the leading last-updated paragraph is split from the policy body", () => {
  expect(splitPolicyLastUpdated("<p>Last updated: November 4, 2026</p>\n<p>All sales are final.</p>")).toEqual({
    lastUpdated: "November 4, 2026",
    body: "\n<p>All sales are final.</p>",
  });
  expect(splitPolicyLastUpdated("<p><strong>Last Updated</strong> March 1, 2027</p><p>Body.</p>").lastUpdated).toBe("March 1, 2027");
});

test("a policy without a leading last-updated line is unchanged", () => {
  const body = "<p>Ships fast.</p><p>Last updated: November 4, 2026</p>";
  expect(splitPolicyLastUpdated(body)).toEqual({ lastUpdated: null, body });
});

test("last-updated text becomes a machine-readable date when it parses", () => {
  expect(toIsoDate("November 4, 2026")).toBe("2026-11-04");
  expect(toIsoDate("sometime soon")).toBeUndefined();
});
