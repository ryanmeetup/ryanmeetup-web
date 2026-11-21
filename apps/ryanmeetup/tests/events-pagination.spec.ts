import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const pager = (page: Page) => page.getByRole("navigation", { name: "events pagination" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bryanCheck", "true"));
});

test("upcoming events page with the shared pagination and keep page and size in the URL", async ({ page }, testInfo) => {
  await page.goto("/events/upcoming?fixture=many-upcoming");
  await expect(pager(page)).toContainText("Showing 1–10 of 12 events");
  await expect(page.getByText("Upcoming Ryan Meetup 10", { exact: true })).toBeVisible();
  await expect(pager(page).getByRole("button", { name: "Previous page" })).toBeDisabled();

  await pager(page).getByRole("button", { name: "Next page" }).click();
  await expect(pager(page)).toContainText("Showing 11–12 of 12 events");
  await expect(page.getByText("Upcoming Ryan Meetup 11", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/[?&]page=2(&|$)/);
  await expect(pager(page).getByRole("button", { name: "Next page" })).toBeDisabled();

  await pager(page).getByRole("button", { name: /^Per page/ }).click();
  await page.getByRole("option", { name: "5", exact: true }).click();
  await expect(pager(page)).toContainText("Showing 1–5 of 12 events");
  await expect(page).toHaveURL(/[?&]perPage=5(&|$)/);
  await expect(page).not.toHaveURL(/[?&]page=/);

  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => { document.documentElement.classList.remove("light", "dark"); document.documentElement.classList.add(value); }, theme);
    for (const width of [390, 1024, 1280, 1536]) {
      await page.setViewportSize({ width, height: 900 });
      await pager(page).scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await pager(page).screenshot({ path: testInfo.outputPath(`events-pager-${theme}-${width}.png`) });
    }
  }
});

test("existing page and perPage links open the page they name", async ({ page }) => {
  await page.goto("/events/upcoming?fixture=many-upcoming&perPage=5&page=3");
  await expect(pager(page)).toContainText("Showing 11–12 of 12 events");
  await expect(page.getByText("Upcoming Ryan Meetup 12", { exact: true })).toBeVisible();
});

test("a list that fits on one page shows no pager", async ({ page }) => {
  await page.goto("/events/upcoming?fixture=with-upcoming");
  await expect(page.getByText("Upcoming Ryan Meetup", { exact: true })).toBeVisible();
  await expect(pager(page)).toHaveCount(0);
});
