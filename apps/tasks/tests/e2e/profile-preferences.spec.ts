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

test("aligns preference selectors to matching card bottoms", async ({ page }) => {
  await signIn(page);
  await page.goto("/profile");

  const cards = await page.locator("[data-profile-preference]").all();
  expect(cards).toHaveLength(3);
  const buttonHeights: number[] = [];
  const bottomInsets: number[] = [];

  for (const card of cards) {
    const cardBox = await card.boundingBox();
    const button = card.getByRole("button");
    await expect(button).toHaveCount(1);
    const buttonBox = await button.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    if (!cardBox || !buttonBox) continue;
    buttonHeights.push(buttonBox.height);
    bottomInsets.push(
      cardBox.y + cardBox.height - buttonBox.y - buttonBox.height,
    );
  }

  expect(new Set(buttonHeights)).toEqual(new Set([42]));
  expect(
    Math.max(...bottomInsets) - Math.min(...bottomInsets),
  ).toBeLessThanOrEqual(1);
});

test("keeps equal page margins around profile fields on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/profile");

  const displayNameBox = await page.getByLabel("Display name").boundingBox();
  const preferencesBox = await page
    .locator("[data-profile-preferences-grid]")
    .boundingBox();
  expect(displayNameBox).not.toBeNull();
  expect(preferencesBox).not.toBeNull();
  if (!displayNameBox || !preferencesBox) return;

  const leftMargin = displayNameBox.x;
  const rightMargin = 390 - displayNameBox.x - displayNameBox.width;
  expect(leftMargin).toBeGreaterThanOrEqual(16);
  expect(Math.abs(leftMargin - rightMargin)).toBeLessThanOrEqual(1);

  const preferencesLeftMargin = preferencesBox.x;
  const preferencesRightMargin =
    390 - preferencesBox.x - preferencesBox.width;
  expect(preferencesLeftMargin).toBeGreaterThanOrEqual(16);
  expect(
    Math.abs(preferencesLeftMargin - preferencesRightMargin),
  ).toBeLessThanOrEqual(1);

  const preferenceCards = await page
    .locator("[data-profile-preferences-grid] > *")
    .all();
  expect(preferenceCards).toHaveLength(6);
  for (const card of preferenceCards) {
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();
    if (!cardBox) continue;
    expect(cardBox.x).toBeGreaterThanOrEqual(preferencesBox.x);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(
      preferencesBox.x + preferencesBox.width,
    );
  }
});
