import { expect, test } from "@playwright/test";

import { isCampaignActive } from "@/utils/campaign";

test.describe("campaign utils", () => {
  test("keeps campaigns active before their expiration", () => {
    expect(
      isCampaignActive(
        "2026-09-13T00:00:00-07:00",
        Date.parse("2026-09-12T23:59:59-07:00"),
      ),
    ).toBe(true);
  });

  test("expires campaigns at the configured time", () => {
    expect(
      isCampaignActive(
        "2026-09-13T00:00:00-07:00",
        Date.parse("2026-09-13T00:00:00-07:00"),
      ),
    ).toBe(false);
  });

  test("fails closed for invalid expiration dates", () => {
    expect(isCampaignActive("not-a-date")).toBe(false);
  });

  test("keeps undated campaigns active", () => {
    expect(isCampaignActive()).toBe(true);
  });
});
