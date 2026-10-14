import { expect, test } from "@playwright/test";

import {
  getActiveCampaign,
  getNextCampaignChange,
  isCampaignActive,
} from "@/utils/campaign";

test.describe("campaign utils", () => {
  test("keeps campaigns active before their expiration", () => {
    expect(
      isCampaignActive(
        { expiresAt: "2026-09-13T00:00:00-07:00" },
        Date.parse("2026-09-12T23:59:59-07:00"),
      ),
    ).toBe(true);
  });

  test("expires campaigns at the configured time", () => {
    expect(
      isCampaignActive(
        { expiresAt: "2026-09-13T00:00:00-07:00" },
        Date.parse("2026-09-13T00:00:00-07:00"),
      ),
    ).toBe(false);
  });

  test("waits for a campaign's start time", () => {
    const window = { startsAt: "2026-11-01T00:00:00-04:00" };

    expect(
      isCampaignActive(window, Date.parse("2026-10-31T23:59:59-04:00")),
    ).toBe(false);
    expect(
      isCampaignActive(window, Date.parse("2026-11-01T00:00:00-04:00")),
    ).toBe(true);
  });

  test("fails closed for invalid dates", () => {
    expect(isCampaignActive({ expiresAt: "not-a-date" })).toBe(false);
    expect(isCampaignActive({ startsAt: "not-a-date" })).toBe(false);
  });

  test("keeps undated campaigns active", () => {
    expect(isCampaignActive()).toBe(true);
  });

  test("picks the first live campaign in priority order", () => {
    const campaigns = [
      { id: "expired", expiresAt: "2026-09-13T00:00:00-07:00" },
      {
        id: "scheduled",
        startsAt: "2026-12-01T00:00:00-05:00",
        expiresAt: "2026-12-26T00:00:00-05:00",
      },
      { id: "current", expiresAt: "2026-11-09T00:00:00-05:00" },
    ];

    expect(
      getActiveCampaign(campaigns, Date.parse("2026-10-14T12:00:00-04:00"))?.id,
    ).toBe("current");
    expect(
      getActiveCampaign(campaigns, Date.parse("2026-12-05T12:00:00-05:00"))?.id,
    ).toBe("scheduled");
    expect(
      getActiveCampaign(campaigns, Date.parse("2027-01-01T00:00:00-05:00")),
    ).toBeUndefined();
  });

  test("reports the next start or expiry to re-check at", () => {
    const campaigns = [
      { expiresAt: "2026-09-13T00:00:00-07:00" },
      {
        startsAt: "2026-12-01T00:00:00-05:00",
        expiresAt: "2026-12-26T00:00:00-05:00",
      },
      { expiresAt: "2026-11-09T00:00:00-05:00" },
    ];

    expect(
      getNextCampaignChange(campaigns, Date.parse("2026-10-14T12:00:00-04:00")),
    ).toBe(Date.parse("2026-11-09T00:00:00-05:00"));
    expect(
      getNextCampaignChange(campaigns, Date.parse("2027-01-01T00:00:00-05:00")),
    ).toBeUndefined();
  });
});
