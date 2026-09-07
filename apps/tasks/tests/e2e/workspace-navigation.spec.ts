import { expect, test, type Page } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";

/**
 * The workspace redirects anyone without a session to /login, and the Supabase
 * double the suite runs against cannot mint one. Demo preview is the app's own
 * way to render the workspace from fixtures instead of the database, so these
 * specs enter through it: the chrome, the routing, and the drawer are the same
 * components either way, and the fixtures make the page content predictable.
 */
async function enterDemoWorkspace(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
  await page.goto("/");
}

test("workspace chrome persists across page navigation", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);

  const shell = page.locator("[data-workspace-shell]");
  const sidebar = page.locator("[data-workspace-sidebar]");
  await expect(shell).toHaveCount(1);
  await expect(sidebar).toBeVisible();
  await page.evaluate(() => {
    Object.assign(window, {
      workspaceShellBeforeNavigation: document.querySelector(
        "[data-workspace-shell]",
      ),
    });
  });

  await sidebar.getByRole("link", { name: "Notes" }).click();
  await expect(page).toHaveURL(/\/notes$/);
  await expect(
    page.getByRole("heading", { level: 1 }).filter({ hasText: "Notes" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        Reflect.get(window, "workspaceShellBeforeNavigation") ===
        document.querySelector("[data-workspace-shell]"),
    ),
  ).toBe(true);
  await expect(sidebar).toBeVisible();
  await expect(page.locator("[data-workspace-content-loading]")).toHaveCount(0);
});

test("opens a project overview from the sidebar", async ({ page, baseURL }) => {
  await enterDemoWorkspace(page, baseURL);

  const sidebar = page.locator("[data-workspace-sidebar]");
  await sidebar.locator('a[href="/projects/website-refresh"]').click();

  await expect(page).toHaveURL(/\/projects\/website-refresh$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Website Refresh/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Needs attention" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Progress by status" }),
  ).toBeVisible();
  const backlogSegment = page.getByLabel(/^Backlog:/);
  await backlogSegment.hover();
  await expect(page.getByRole("tooltip")).toContainText("Backlog");
  await expect(page.getByRole("tooltip")).toContainText("of project");
  await expect(
    page.getByRole("link", { name: "Open task board", exact: true }),
  ).toHaveAttribute("href", "/board?project=Website%20Refresh");
  await expect(
    page.getByRole("link", { name: "View open tasks", exact: true }),
  ).toHaveAttribute(
    "href",
    "/board?project=Website+Refresh&excludeStatuses=Done",
  );
  await expect(
    page.getByRole("link", { name: "View overdue", exact: true }),
  ).toHaveAttribute(
    "href",
    "/board?project=Website+Refresh&excludeStatuses=Done&dueWithin=overdue",
  );
  await expect(
    page.getByRole("link", { name: "View due in 14 days", exact: true }),
  ).toHaveAttribute(
    "href",
    "/board?project=Website+Refresh&excludeStatuses=Done&dueWithin=14",
  );
  const metrics = page.getByRole("region", { name: "Project at a glance" });
  await expect(metrics.getByText("Complete", { exact: true })).toHaveCount(2);
  await expect(
    metrics.getByRole("link", { name: "View complete", exact: true }),
  ).toHaveCount(0);
});

test("opens a project's board directly from the sidebar", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);

  const sidebar = page.locator("[data-workspace-sidebar]");
  const boardLink = sidebar.getByRole("link", {
    name: "Open Website Refresh board",
  });
  await expect(boardLink).toHaveAttribute(
    "href",
    "/board?project=Website+Refresh",
  );
  await boardLink.click();

  await expect(page).toHaveURL(/\/board\?project=Website\+Refresh$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Website Refresh/ }),
  ).toBeVisible();
});

test("keeps project details in view while the overview scrolls", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/projects/website-refresh");

  const sidebar = page.getByTestId("project-overview-sidebar");
  const initialBox = await sidebar.boundingBox();
  expect(initialBox?.y).toBeGreaterThan(96);

  await page.evaluate(() => window.scrollTo(0, 700));
  await expect
    .poll(async () => Math.round((await sidebar.boundingBox())?.y ?? -1))
    .toBe(96);
});

test("aligns board column searches across description lengths", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/board");

  const searches = page.locator(
    'section input[aria-label^="Search "][aria-label$=" tasks"]',
  );
  await expect(searches).toHaveCount(6);

  const topPositions = await searches.evaluateAll((inputs) =>
    inputs.map((input) => input.getBoundingClientRect().top),
  );
  expect(Math.max(...topPositions) - Math.min(...topPositions)).toBeLessThan(1);
});

test("keeps the board scroller next to the footer", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/board");

  const doneColumn = page.locator("section").filter({
    has: page.getByRole("heading", { level: 2, name: "Done" }),
  });
  const boardScroller = doneColumn.locator("..");
  const footer = page.locator(".tasks-footer");
  await expect(boardScroller).toBeVisible();
  await expect(footer).toBeVisible();

  const [boardBox, columnBox, footerBox] = await Promise.all([
    boardScroller.boundingBox(),
    doneColumn.boundingBox(),
    footer.boundingBox(),
  ]);
  expect(boardBox).not.toBeNull();
  expect(columnBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  const gap = footerBox!.y - (boardBox!.y + boardBox!.height);
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThanOrEqual(1);
  const columnInset =
    boardBox!.y + boardBox!.height - (columnBox!.y + columnBox!.height);
  expect(columnInset).toBeGreaterThanOrEqual(24);

  const columnBackground = await doneColumn.evaluate(
    (column) => getComputedStyle(column).backgroundColor,
  );
  expect(columnBackground).not.toMatch(/^rgba\(.+, 0\.\d+\)$/);
});

test("keeps a column's search and divider in view while its tasks scroll", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/board");

  const search = page.getByRole("searchbox", {
    name: "Search In Progress tasks",
  });
  await expect(search).toBeVisible();

  const chrome = page.locator("[data-board-column-header]").first();
  // The divider is the edge the tasks scroll into, so it is part of the
  // column at rest rather than something the scroll position turns on.
  await expect(chrome).toHaveCSS("border-bottom-width", "1px");

  await page.mouse.wheel(0, 800);
  const appHeader = page.locator(".tasks-app-header").first();
  await expect
    .poll(async () => {
      const [searchBox, chromeBox] = await Promise.all([
        search.boundingBox(),
        appHeader.boundingBox(),
      ]);
      return searchBox!.y - (chromeBox!.y + chromeBox!.height);
    })
    .toBeGreaterThan(0);
  await expect(search).toBeInViewport();
});

test("keeps a task's icons from painting over the pinned column chrome", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/board");
  await expect(
    page.getByRole("searchbox", { name: "Search In Progress tasks" }),
  ).toBeVisible();

  const link = await page.evaluate(async () => {
    const column = [...document.querySelectorAll("[data-board-column]")].find(
      (section) => section.querySelector("h2")?.textContent === "In Progress",
    )!;
    const chrome = column.querySelector("[data-board-column-header]")!;
    const icon = column.querySelector<HTMLElement>('a[aria-label^="Go to"]')!;
    const settle = () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );

    // Creep down until a card's link is behind the pinned block, then ask the
    // browser what is on top of it: a card that paints above the block shows
    // its icons through an otherwise opaque surface.
    for (let step = 0; step < 120; step += 1) {
      const block = chrome.getBoundingClientRect();
      const rect = icon.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      if (y < block.top) break;
      if (y < block.bottom - 2) {
        const hit = document.elementFromPoint(x, y);
        return { behind: true, covered: !!hit && chrome.contains(hit) };
      }
      window.scrollBy(0, 12);
      await settle();
    }
    return { behind: false, covered: false };
  });

  expect(link.behind).toBe(true);
  expect(link.covered).toBe(true);
});

test("keeps a collapsed board column's header in view", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/board");

  const doneColumn = page.locator("section").filter({
    has: page.getByRole("heading", { level: 2, name: "Done" }),
  });
  const inProgressColumn = page.locator("section").filter({
    has: page.getByRole("heading", { level: 2, name: "In Progress" }),
  });

  await doneColumn.getByRole("button", { name: "Collapse “Done”" }).click();
  await expect(
    doneColumn.getByRole("button", { name: "Expand “Done”" }),
  ).toBeVisible();

  // Collapsing takes away the cards and narrows the column, but leaves its
  // full height in place: the heading is all that is left to pin, and a column
  // that shrank to its own heading would carry it off the top of the board.
  await expect(
    doneColumn.getByRole("button", { name: /^Open / }).first(),
  ).toBeHidden();
  const [collapsed, expanded] = await Promise.all([
    doneColumn.boundingBox(),
    inProgressColumn.boundingBox(),
  ]);
  expect(collapsed!.width).toBeLessThan(expanded!.width);
  expect(collapsed!.height).toBeGreaterThan(400);

  await page.mouse.wheel(0, 800);
  const heading = doneColumn.locator("[data-board-column-header]");
  const appHeader = page.locator(".tasks-app-header").first();
  await expect
    .poll(async () => {
      const [headingBox, chromeBox] = await Promise.all([
        heading.boundingBox(),
        appHeader.boundingBox(),
      ]);
      return Math.abs(headingBox!.y - (chromeBox!.y + chromeBox!.height));
    })
    .toBeLessThan(2);
});

test.describe("mobile workspace navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps the workspace shell mounted after using the drawer", async ({
    page,
    baseURL,
  }) => {
    await enterDemoWorkspace(page, baseURL);
    await expect(page.locator("[data-workspace-shell]")).toHaveCount(1);
    await page.evaluate(() => {
      Object.assign(window, {
        mobileWorkspaceShellBeforeNavigation: document.querySelector(
          "[data-workspace-shell]",
        ),
      });
    });

    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog");
    await expect(
      drawer.getByRole("button", { name: "Close navigation" }),
    ).toBeVisible();
    await drawer.getByRole("link", { name: "Notes" }).click();

    await expect(page).toHaveURL(/\/notes$/);
    expect(
      await page.evaluate(
        () =>
          Reflect.get(window, "mobileWorkspaceShellBeforeNavigation") ===
          document.querySelector("[data-workspace-shell]"),
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Open navigation" }),
    ).toBeVisible();
    await expect(
      page.getByRole("tooltip", { name: "Open navigation" }),
    ).not.toBeVisible();
  });

  test("keeps the project overview scannable from the drawer", async ({
    page,
    baseURL,
  }) => {
    await enterDemoWorkspace(page, baseURL);
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog");
    await expect(
      drawer.getByRole("button", { name: "Close navigation" }),
    ).toBeVisible();
    await drawer.locator('a[href="/projects/website-refresh"]').click();

    await expect(page).toHaveURL(/\/projects\/website-refresh$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Website Refresh/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Project team" }),
    ).toBeVisible();
    const projectTeam = page
      .getByRole("heading", { level: 2, name: "Project team" })
      .locator("..")
      .locator("..");
    await expect(projectTeam.getByText("Taylor Brooks")).toBeVisible();
    await expect(projectTeam.getByText("Project owners")).toBeVisible();
    await expect(projectTeam.getByText("Alex Morgan")).toBeVisible();
    await expect(projectTeam.getByText("Jordan Lee")).toBeVisible();
    await expect(projectTeam.getByText("Team members")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Upcoming dates" }),
    ).toBeVisible();
  });
});
