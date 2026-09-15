import { expect, test } from "@playwright/test";

test("replaces archive rows with ten placeholders while closed-date sorting loads", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("member@example.com");
  await page.getByLabel(/^Password/).fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("[data-workspace-shell]")).toBeVisible();
  await page.goto("/board?visibility=archived&pageSize=25");
  const table = page.locator("main table").first();
  await expect(table).toBeVisible();
  await expect(
    table.getByText("Nothing archived yet.", { exact: false }),
  ).toBeVisible();

  let releaseRequest!: () => void;
  const requestPending = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route("**/api/tasks?**", async (route) => {
    await requestPending;
    await route.continue();
  });

  await table.getByRole("button", { name: "Closed" }).click();
  await expect(
    table.locator("tbody > tr[data-task-list-skeleton]"),
  ).toHaveCount(10);
  await expect(
    table.getByText("Nothing archived yet.", { exact: false }),
  ).toHaveCount(0);

  for (const width of [375, 1024, 1280, 1536]) {
    await page.setViewportSize({ width, height: 844 });
    const skeletons =
      width < 768
        ? page.locator("main .md\\:hidden [data-task-list-skeleton]")
        : table.locator("tbody > tr[data-task-list-skeleton]");
    await expect(skeletons).toHaveCount(10);
    await expect(skeletons.first()).toBeVisible();
  }

  releaseRequest();
  await expect(
    table.locator("tbody > tr[data-task-list-skeleton]"),
  ).toHaveCount(0);
  await expect(
    table.getByText("Nothing archived yet.", { exact: false }),
  ).toBeVisible();
});
