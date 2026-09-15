import { expect, test, type Page } from "@playwright/test";

/** Holds every activity request until the returned release is called. */
async function holdActivityRequests(page: Page) {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.unroute("**/api/activity?**");
  await page.route("**/api/activity?**", async (route) => {
    await pending;
    await route.continue();
  });
  return release;
}

test("replaces the activity feed with ten placeholders while it loads", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("member@example.com");
  await page.getByLabel(/^Password/).fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("[data-workspace-shell]")).toBeVisible();

  const skeletons = page.locator("main [data-activity-skeleton]:visible");
  const emptyMessage = page
    .getByText("No activity yet.", { exact: false })
    .locator("visible=true");

  let release = await holdActivityRequests(page);
  await page.goto("/activity");
  await expect(skeletons).toHaveCount(10);
  await expect(emptyMessage).toHaveCount(0);

  for (const width of [375, 1024, 1280, 1536]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(skeletons).toHaveCount(10);
    await expect(skeletons.first()).toBeVisible();
  }

  release();
  await expect(skeletons).toHaveCount(0);
  await expect(emptyMessage.first()).toBeVisible();

  release = await holdActivityRequests(page);
  const filtersToggle = page.getByRole("button", { name: "Filters" });
  if ((await filtersToggle.getAttribute("aria-expanded")) !== "true") {
    await filtersToggle.click();
  }
  await page.getByRole("button", { name: /^When/ }).click();
  await page.getByRole("option", { name: "Past 7 days" }).click();
  await expect(skeletons).toHaveCount(10);

  release();
  await expect(skeletons).toHaveCount(0);
});
