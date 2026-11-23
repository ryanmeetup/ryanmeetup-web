import { expect, test } from "@playwright/test";

const teamCards = (page: import("@playwright/test").Page) =>
  page.getByRole("list", { name: /\d+ teams?/ }).getByRole("listitem");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bryanCheck", "true"));
});

test("baseball page is unlisted", async ({ page, request }) => {
  await page.goto("/baseball");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );

  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).not.toContain("/baseball");
});

test("lists every team with tickets and merch", async ({ page }) => {
  await page.goto("/baseball");

  await expect(
    page.getByRole("heading", { level: 1, name: "The Ryan Baseball Classic" }),
  ).toBeVisible();
  await expect(teamCards(page)).toHaveCount(6);
  await expect(
    page.getByRole("link", { name: /Tickets for Manchester Ryanlanders/ }),
  ).toHaveAttribute("href", "https://example.com/tickets/manchester");
  await expect(page.getByRole("link", { name: /Classic Jersey/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Every Ryan Baseball Classic night includes..." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "See the map" })).toHaveAttribute(
    "href",
    "#map",
  );
  await expect(
    page.getByRole("link", { name: "Ask a question" }),
  ).toHaveAttribute("href", "/contact?topic=baseball-classic");
});

test("a state without a team shows the team that covers it", async ({ page }) => {
  await page.goto("/baseball?state=VT");

  await expect(teamCards(page)).toHaveCount(1);
  await expect(teamCards(page).first()).toContainText("Manchester Ryanlanders");
  await expect(teamCards(page).first()).toContainText("Near Vermont");
  await expect(page.getByTestId("baseball-marker")).toHaveCount(1);
});

test("filters stay in the URL and clear together", async ({ page }) => {
  await page.goto("/baseball");

  await page.getByRole("button", { name: /Date/ }).click();
  await page.getByRole("option", { name: /Jul 10, 2027/ }).click();
  await expect(page).toHaveURL(/date=2027-07-10/);
  await expect(teamCards(page)).toHaveCount(2);

  await page.reload();
  await expect(teamCards(page)).toHaveCount(2);

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).not.toHaveURL(/date=/);
  await expect(teamCards(page)).toHaveCount(6);
});

test("zip search lists nearby teams, nearest first", async ({ page }) => {
  await page.goto("/baseball");

  await page.getByLabel("Search teams").fill("01608");
  await expect(page).toHaveURL(/q=01608/);
  await expect(
    page.getByText(/Teams within 120 miles of Worcester, Massachusetts/),
  ).toBeVisible();
  await expect(teamCards(page).first()).toContainText("Worcester Ryan Sox");
  await expect(teamCards(page).first()).toContainText("0 mi away");
  await expect(page.getByText("Columbus Clip-Ryans")).toHaveCount(0);
});

test("zip search far from every team offers the nearest ones", async ({ page }) => {
  // An old ?zip= link still works, and moves to ?q=.
  await page.goto("/baseball?zip=05401");
  await expect(page).toHaveURL(/q=05401/);
  await expect(page).not.toHaveURL(/zip=/);

  await expect(
    page.getByText(/No teams within 120 miles of Burlington, Vermont/),
  ).toBeVisible();
  await expect(teamCards(page)).toHaveCount(2);
});

test("a Canadian postal code searches near it", async ({ page }) => {
  await page.goto("/baseball");

  const search = page.getByLabel("Search teams");
  await search.fill("V6B");
  await expect(page.getByText("Enter your full postal code, like V6B 1A1.")).toBeVisible();

  await search.fill("v6b1a1");
  await expect(page).toHaveURL(/q=v6b1a1/);
  await expect(
    page.getByText(/No teams within 120 miles of Vancouver, British Columbia, Canada/),
  ).toBeVisible();
  await expect(teamCards(page)).toHaveCount(2);
});

test("teams still on a tbd.com ticket link can't be clicked through", async ({
  page,
}) => {
  await page.goto("/baseball?team=sacramento-river-ryans");

  await expect(teamCards(page)).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /Sacramento River Ryans aren't on sale/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: /Tickets for Sacramento River Ryans/ }),
  ).toHaveCount(0);
});

test("search matches team, city, and state names", async ({ page }) => {
  await page.goto("/baseball");

  await page.getByLabel("Search teams").fill("worcester");
  await expect(page).toHaveURL(/q=worcester/);
  await expect(teamCards(page)).toHaveCount(1);
  await expect(teamCards(page).first()).toContainText("Worcester Ryan Sox");

  await page.getByLabel("Search teams").fill("new hampshire");
  await expect(teamCards(page)).toHaveCount(1);
  await expect(teamCards(page).first()).toContainText("Manchester Ryanlanders");

  await page.getByLabel("Search teams").fill("01608");
  await expect(page).toHaveURL(/q=01608/);
  await expect(
    page.getByText(/Teams within 120 miles of Worcester, Massachusetts/),
  ).toBeVisible();
});
