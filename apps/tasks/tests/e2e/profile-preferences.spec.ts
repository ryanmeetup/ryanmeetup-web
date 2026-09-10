import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill("member@example.com");
  await page.getByLabel(/^Password/).fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("[data-workspace-shell]")).toBeVisible();
}

test("defaults Calendar to any selected combination of sources", async ({
  page,
}) => {
  await signIn(page);

  await page.goto("/profile");
  const showSources = page.getByRole("button", { name: /^Show/ });
  await expect(showSources).toContainText(
    "Deadlines, Time away, Important dates +1",
  );
  await page.route("**/api/profile", async (route) => {
    await route.fulfill({ status: 200, json: { profile: {} } });
  });
  await showSources.click();
  await page.getByRole("option", { name: "Google Calendar" }).click();

  await expect(showSources).toContainText(
    "Deadlines, Time away, Important dates",
  );
  await expect(
    page.getByRole("option", { name: "Google Calendar" }),
  ).toHaveAttribute("aria-selected", "false");
  await expect(
    page.getByText(
      "Open the calendar with Deadlines, Time away, Important dates visible.",
    ),
  ).toBeVisible();
});

test("keeps equal page margins around profile fields on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/profile");

  const displayNameBox = await page.getByLabel("Display name").boundingBox();
  expect(displayNameBox).not.toBeNull();
  if (!displayNameBox) return;

  const leftMargin = displayNameBox.x;
  const rightMargin = 390 - displayNameBox.x - displayNameBox.width;
  expect(leftMargin).toBeGreaterThanOrEqual(16);
  expect(Math.abs(leftMargin - rightMargin)).toBeLessThanOrEqual(1);
});
