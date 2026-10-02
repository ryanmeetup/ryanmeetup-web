import { expect, test } from "@playwright/test";

test("shows the upcoming Rytoberfest chapter lineup", async ({ page }) => {
  await page.goto("/rytoberfest?fixture=rytoberfest");

  await expect(
    page.getByRole("heading", { name: "Rytoberfest is brewing." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Upcoming Rytoberfests" }),
  ).toBeVisible();
  await expect(page.getByText("Twin Cities Rytoberfest")).toBeVisible();
  await expect(page.getByText("Denver Rytoberfest 2026")).toBeVisible();
  await expect(page.getByText("A Regular Ryan Meetup")).not.toBeVisible();
  await expect(page.getByText("2 chapters · 2 celebrations")).toBeVisible();
});
