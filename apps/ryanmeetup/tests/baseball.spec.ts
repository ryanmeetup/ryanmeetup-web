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

test("paginates teams with tickets and merch on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/baseball");

  await expect(
    page.getByRole("heading", { level: 1, name: "The Ryan Baseball Classic" }),
  ).toBeVisible();
  await expect(teamCards(page)).toHaveCount(5);
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
    page.getByRole("link", { name: "Sing the anthem" }),
  ).toHaveAttribute("href", "https://forms.gle/1i7iNp52M7Dfzp966");
  await expect(
    page.getByRole("link", { name: "Ask a question" }),
  ).toHaveAttribute("href", "/contact?topic=baseball-classic");
  await expect(
    page.getByRole("link", { name: "Partner as a baseball team" }),
  ).toHaveAttribute(
    "href",
    "/contact?topic=baseball-classic&detail=team-partner&source=baseball",
  );

  const pagination = page.getByRole("navigation", { name: "teams pagination" });
  await expect(pagination).toContainText("Showing 1–5 of 6 teams");
  await pagination.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(teamCards(page)).toHaveCount(1);
  await expect(teamCards(page).first()).toContainText("Sacramento River Ryans");

  await pagination.getByRole("button", { name: /Rows/ }).click();
  await page.getByRole("option", { name: "10", exact: true }).click();
  await expect(page).toHaveURL(/perPage=10/);
  await expect(teamCards(page)).toHaveCount(6);
  await expect(pagination).toContainText("Page 1 of 1");

  await pagination.getByRole("button", { name: /Rows/ }).click();
  await page.getByRole("option", { name: "5", exact: true }).click();
  await expect(teamCards(page)).toHaveCount(5);
  await expect(pagination).toContainText("Page 1 of 2");
});

test("a state without a team shows the team that covers it", async ({ page }) => {
  await page.goto("/baseball?state=VT");

  await expect(teamCards(page)).toHaveCount(1);
  await expect(teamCards(page).first()).toContainText("Manchester Ryanlanders");
  await expect(teamCards(page).first()).toContainText("Near Vermont");
  await expect(page.getByTestId("baseball-marker")).toHaveCount(1);
});

test("mobile puts game results before night details, merch, and the map", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/baseball");

  await expect(
    page.locator('a[href="#find"]').filter({ hasText: "Find your game" }),
  ).toBeInViewport();
  await expect(page.getByRole("link", { name: "Sing the anthem" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Photo albums" })).toBeInViewport();

  const topOf = async (selector: string) => {
    const box = await page.locator(selector).boundingBox();
    expect(box).not.toBeNull();
    return box!.y;
  };
  expect(await topOf("#find")).toBeLessThan(await topOf("#includes"));
  expect(await topOf("#includes")).toBeLessThan(await topOf("#merch"));
  expect(await topOf("#find-results")).toBeLessThan(await topOf("#map"));

  await page.getByRole("button", { name: "Photo albums" }).click();
  await expect(page.getByRole("menuitem")).toHaveCount(2);
});

test("mobile map shows by default, toggles, and reopens from repeated or shared map links", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/baseball?state=VT");

  await expect(page.getByTestId("baseball-marker")).toHaveCount(1);
  await page.getByRole("button", { name: "Hide team map" }).click();
  await expect(page.getByTestId("baseball-map")).toHaveCount(0);
  await page.getByRole("button", { name: "Show team map" }).click();
  await expect(page.getByTestId("baseball-marker")).toHaveCount(1);
  await page.getByRole("button", { name: "Hide team map" }).click();
  await expect(page.getByTestId("baseball-map")).toHaveCount(0);

  const mapLink = page
    .getByRole("navigation", { name: "Jump to section" })
    .getByRole("link", { name: "Team map", exact: true });
  await page.getByRole("link", { name: "See the map", exact: true }).click();
  await expect(page).toHaveURL("/baseball?state=VT#map");
  await expect(page.getByTestId("baseball-map")).toBeInViewport();

  await page.getByRole("button", { name: "Hide team map" }).click();
  await mapLink.click();
  await expect(page.getByTestId("baseball-marker")).toHaveCount(1);

  await page.reload();
  await expect(page.getByTestId("baseball-map")).toBeInViewport();
  await expect(teamCards(page)).toHaveCount(1);
});

test("desktop map stays visible when the mobile map is collapsed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/baseball");
  await expect(page.getByTestId("baseball-map")).toBeVisible();
  await page.getByRole("button", { name: "Hide team map" }).click();
  await expect(page.getByTestId("baseball-map")).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByTestId("baseball-map")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show team map" })).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("baseball-map")).toHaveCount(0);
});

for (const width of [390, 1280]) {
  test(`floating navigation jumps to baseball sections at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/baseball?state=VT");

    const nav = page.getByRole("navigation", { name: "Jump to section" });
    await expect(nav).toBeInViewport();

    for (const [name, hash] of [
      ["Night details", "#includes"],
      ["Classic merch", "#merch"],
      ["Find your game", "#find"],
      ["Team map", "#map"],
      ["Questions", "#questions"],
    ]) {
      await nav.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(`/baseball?state=VT${hash}`);
      await expect(page.locator(hash)).toBeInViewport();
      await expect(nav).toBeInViewport();
    }

    const details = nav.getByRole("link", { name: "Night details", exact: true });
    await details.focus();
    await details.press("Enter");
    await expect(page).toHaveURL("/baseball?state=VT#includes");
    await expect(teamCards(page)).toHaveCount(1);
  });
}

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
  await expect(teamCards(page)).toHaveCount(5);
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
