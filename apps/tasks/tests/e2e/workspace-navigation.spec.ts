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
    page.getByRole("heading", { level: 2, name: "Attention & dates" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Needs attention" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Next 90 days" }),
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
  const start = Math.round((await sidebar.boundingBox())?.y ?? -1);
  expect(start).toBeGreaterThan(96);

  /*
    A sticky column can only pin while the column beside it is taller, so the
    sidebar must hold cards whose height the project's data cannot grow. Lists
    that stretch with the workspace belong in the main column instead.
  */
  const sidebarHeight = (await sidebar.boundingBox())?.height ?? 0;
  const mainHeight =
    (await page.getByTestId("project-overview-main").boundingBox())?.height ??
    0;
  expect(sidebarHeight).toBeLessThan(mainHeight);

  /*
    Scroll by exactly where the sidebar starts, so its natural position lands
    at the top of the screen and holding the 96px offset costs 96px of travel.
    A fixed, larger scroll would not do: a sticky element stops at the bottom
    of its containing block, and the sidebar carries the project context card
    now, so its column runs out of slack sooner than it used to. Asking for the
    least travel that still proves the pin keeps this about `xl:top-24` rather
    than about how tall the two columns happen to be.
  */
  await page.evaluate((y) => window.scrollTo(0, y), start);
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

test("fills the available viewport without a board footer", async ({
  page,
  baseURL,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/board");

  const doneColumn = page.locator("section").filter({
    has: page.getByRole("heading", { level: 2, name: "Done" }),
  });
  const boardScroller = doneColumn.locator("..");
  await expect(boardScroller).toBeVisible();

  const [boardBox, columnBox] = await Promise.all([
    boardScroller.boundingBox(),
    doneColumn.boundingBox(),
  ]);
  expect(boardBox).not.toBeNull();
  expect(columnBox).not.toBeNull();
  expect(
    Math.abs(
      columnBox!.y + columnBox!.height - (boardBox!.y + boardBox!.height),
    ),
  ).toBeLessThan(1);

  const columnBackground = await doneColumn.evaluate(
    (column) => getComputedStyle(column).backgroundColor,
  );
  expect(columnBackground).not.toMatch(/^rgba\(.+, 0\.\d+\)$/);

  const footer = page.locator(".tasks-footer");
  await expect(footer).toHaveCount(0);
  // Resize the same mounted board across the mobile and desktop boundaries.
  // Align its top with the toolbar + notices + outside page gap, then check
  // the visible column extends all the way down to the viewport edge.
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1024, height: 768 },
    { width: 1280, height: 900 },
    { width: 1536, height: 1100 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(async () =>
        boardScroller.evaluate((board) => {
          const header = document.querySelector(".tasks-app-header")!;
          const notices = document.querySelector("[data-workspace-banners]")!;
          const gap = parseFloat(
            getComputedStyle(board.closest("[data-board-page]")!).paddingTop,
          );
          const top =
            header.getBoundingClientRect().height +
            notices.getBoundingClientRect().height +
            gap;
          return Math.abs(
            board.getBoundingClientRect().height - (window.innerHeight - top),
          );
        }),
      )
      .toBeLessThan(1);
    await boardScroller.evaluate((board) => {
      const inset = parseFloat(
        getComputedStyle(board).getPropertyValue("--board-top-inset"),
      );
      window.scrollBy(0, board.getBoundingClientRect().top - inset);
    });
    await expect
      .poll(async () =>
        boardScroller.evaluate((board) =>
          Math.abs(board.getBoundingClientRect().bottom - window.innerHeight),
        ),
      )
      .toBeLessThan(1);
    const visibleColumn = page.locator("[data-board-column]").first();
    const list = visibleColumn.locator("[class*='overflow-y-auto']");
    expect(
      Math.abs(
        (await list.boundingBox())!.y +
          (await list.boundingBox())!.height -
          viewport.height,
      ),
    ).toBeLessThan(1);
    await page.evaluate(
      (dark) => document.documentElement.classList.toggle("dark", dark),
      viewport.width >= 1280,
    );
    await page.screenshot({
      path: testInfo.outputPath(`board-${viewport.width}.png`),
      animations: "disabled",
    });
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    ),
  ).toBeGreaterThan(0);
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect(footer).toHaveCount(0);
  await page
    .locator("[data-workspace-sidebar]")
    .getByRole("link", { name: "Contacts", exact: true })
    .click();
  await expect(footer).toHaveCount(1);
  await page
    .locator("[data-workspace-sidebar]")
    .getByRole("link", { name: "Tasks", exact: true })
    .click();
  await expect(footer).toHaveCount(0);
});

test("holds a column's chrome still while its own tasks scroll", async ({
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

  const column = page.locator("[data-board-column]").filter({
    has: page.getByRole("heading", { level: 2, name: "In Progress" }),
  });
  const chrome = column.locator("[data-board-column-header]");
  // The divider is the edge the tasks scroll into, so it is part of the
  // column at rest rather than something a scroll position turns on.
  const divider = chrome.locator("> :first-child");
  await expect(divider).toHaveCSS("border-bottom-width", "1px");

  const measure = () =>
    column.evaluate((section) => {
      const round = (n: number) => Math.round(n * 10) / 10;
      const list = section.querySelector<HTMLElement>(
        "[data-board-column-header] ~ * [class*='overflow-y-auto']",
      )!;
      const rule = section
        .querySelector("[data-board-column-header]")!
        .firstElementChild!.getBoundingClientRect();
      const card = section.querySelector('[draggable="true"]')!;
      return {
        scrollTop: list.scrollTop,
        scrollable: list.scrollHeight > list.clientHeight,
        // The scroller starts on the rule, so this is 0 at every scroll
        // position: nothing sits between the two for a task to stop short at.
        gutter: round(list.getBoundingClientRect().top - rule.bottom),
        bottomGutter: round(
          section.getBoundingClientRect().bottom -
            list.getBoundingClientRect().bottom,
        ),
        rule: round(rule.bottom),
        // The room the first task rests in belongs to the scroller, so it
        // travels with the task rather than holding it off the rule.
        cardOffset: round(card.getBoundingClientRect().top - rule.bottom),
        sideInset: round(
          card.getBoundingClientRect().left -
            section.getBoundingClientRect().left,
        ),
      };
    });

  const atRest = await measure();
  expect(atRest.scrollable).toBe(true);
  expect(atRest.scrollTop).toBe(0);
  expect(atRest.gutter).toBe(0);
  expect(atRest.bottomGutter).toBe(0);
  // At rest that room matches the inset the cards keep at their sides.
  expect(atRest.cardOffset).toBe(atRest.sideInset);

  // Scrolling is the column's own, so the page never moves and the chrome
  // never has to chase it.
  await column.locator('[draggable="true"]').first().hover();
  await page.mouse.wheel(0, 400);
  await expect.poll(async () => (await measure()).scrollTop).toBeGreaterThan(0);
  const scrolled = await measure();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(scrolled.rule).toBe(atRest.rule);
  expect(scrolled.gutter).toBe(0);
  expect(scrolled.bottomGutter).toBe(0);
  // The resting room went with the task, up past the rule and out of sight.
  expect(scrolled.cardOffset).toBeLessThan(0);
  await expect(search).toBeInViewport();
});

test("clips a scrolling task at the column's rule, not short of it", async ({
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
    const list = column.querySelector<HTMLElement>(
      "[class*='overflow-y-auto']",
    )!;
    const icon = column.querySelector<HTMLElement>('a[aria-label^="Go to"]')!;
    const card = icon.closest('[draggable="true"]')!;
    const settle = () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );

    // Follow a card link up to the top of the list and past it, in steps small
    // enough to sample either side of the rule. The card has to keep being
    // painted and keep taking clicks all the way to the rule — stopping short
    // of it would leave the strip of dead space this is guarding against —
    // and to stop at once above it, where the column shows its own chrome.
    let lastPainted = Infinity;
    let firstCovered = -Infinity;
    let flush = Infinity;
    let ruleBottom = 0;
    for (let step = 0; step < 400; step += 1) {
      const block = chrome.getBoundingClientRect();
      const rule = chrome.firstElementChild!.getBoundingClientRect();
      ruleBottom = rule.bottom;
      flush = Math.min(flush, list.getBoundingClientRect().top - rule.bottom);
      const rect = icon.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      const covered = !hit || !card.contains(hit);
      if (covered) firstCovered = Math.max(firstCovered, y);
      else lastPainted = Math.min(lastPainted, y);
      if (y < block.top) break;
      list.scrollTop += 4;
      await settle();
    }
    return {
      // How far the list's own top sits from the rule: flush, so a task runs
      // right into it.
      flush: Math.round(flush * 10) / 10,
      // Where the card stopped being painted, relative to the rule.
      lastPainted: Math.round((lastPainted - ruleBottom) * 10) / 10,
      firstCovered: Math.round((firstCovered - ruleBottom) * 10) / 10,
      // Nothing chases the page: the column clips its own overflow.
      overflow: getComputedStyle(column).overflow,
      radius: getComputedStyle(column).borderTopLeftRadius,
      pageScrolled: window.scrollY,
    };
  });

  expect(link.flush).toBe(0);
  // Painted right up to the rule and no further: the crossover is the rule
  // itself, within the step the loop scrolls by.
  expect(link.lastPainted).toBeGreaterThanOrEqual(-1);
  expect(link.lastPainted).toBeLessThanOrEqual(5);
  expect(link.firstCovered).toBeLessThanOrEqual(1);
  expect(link.overflow).toBe("hidden");
  expect(link.radius).not.toBe("0px");
  expect(link.pageScrolled).toBe(0);
});

test("turns a collapsed board column into a drag landing lane", async ({
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

  // At rest, a collapsed status keeps its useful context and search controls,
  // but not an empty column that happens to retain the board's full height.
  await expect(
    doneColumn.getByRole("button", { name: /^Open / }).first(),
  ).toBeHidden();
  await expect(
    doneColumn.getByRole("searchbox", { name: "Search Done tasks" }),
  ).toBeVisible();
  await expect(
    doneColumn.getByText("Finished work that no longer needs action.", {
      exact: true,
    }),
  ).toBeVisible();
  const [collapsed, expanded, collapsedDivider, expandedDivider] =
    await Promise.all([
      doneColumn.boundingBox(),
      inProgressColumn.boundingBox(),
      doneColumn
        .locator("[data-board-column-header] > :first-child")
        .boundingBox(),
      inProgressColumn
        .locator("[data-board-column-header] > :first-child")
        .boundingBox(),
    ]);
  expect(Math.abs(collapsed!.width - expanded!.width)).toBeLessThan(1);
  // Line the dividers up, not the blocks around them: only a column with
  // tasks underneath carries the gutter they scroll into.
  expect(
    Math.abs(
      collapsedDivider!.y +
        collapsedDivider!.height -
        (expandedDivider!.y + expandedDivider!.height),
    ),
  ).toBeLessThan(1);
  await expect
    .poll(async () => (await doneColumn.boundingBox())?.height ?? Infinity)
    .toBeLessThan(240);

  // As soon as a card is picked up, collapsed statuses become full-height,
  // named targets. That keeps them easy to reach without leaving dead space
  // on the board the rest of the time.
  await inProgressColumn
    .locator('[draggable="true"]')
    .first()
    .evaluate((card) => {
      card.dispatchEvent(
        new DragEvent("dragstart", {
          bubbles: true,
          dataTransfer: new DataTransfer(),
        }),
      );
    });
  await expect(
    doneColumn.getByText("Drop in Done", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await doneColumn.boundingBox())?.height ?? 0)
    .toBeGreaterThan(400);

  await inProgressColumn
    .locator('[draggable="true"]')
    .first()
    .evaluate((card) => {
      card.dispatchEvent(new DragEvent("dragend", { bubbles: true }));
    });
  await expect(
    doneColumn.getByText("Drop in Done", { exact: true }),
  ).toBeHidden();

  await doneColumn.getByRole("button", { name: "Expand “Done”" }).click();
  const expandedTasks = doneColumn.locator('[id^="status-column-"] > div');
  await expect(expandedTasks).toHaveCSS("transition-property", /transform/);
  await expect(
    doneColumn.getByRole("button", { name: /^Open / }).first(),
  ).toBeVisible();
});

test("expands a collapsed board column when its search begins", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/board");

  const doneColumn = page.locator("section").filter({
    has: page.getByRole("heading", { level: 2, name: "Done" }),
  });
  await doneColumn.getByRole("button", { name: "Collapse “Done”" }).click();

  await doneColumn
    .getByRole("searchbox", { name: "Search Done tasks" })
    .fill("launch");

  await expect(
    doneColumn.getByRole("button", { name: "Collapse “Done”" }),
  ).toBeVisible();
  await expect(doneColumn).not.toHaveAttribute("data-collapsed", "");
  const expandedTasks = doneColumn.locator('[id^="status-column-"] > div');
  await expect(expandedTasks).toHaveCSS("transition-property", /transform/);
  await expect(expandedTasks).toHaveCSS("transition-duration", "0.3s");
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
    // Project dates moved into the main column, so the sticky sidebar stays
    // shorter than the content it sticks against.
    await expect(
      page
        .getByTestId("project-overview-sidebar")
        .getByRole("heading", { name: "Next 90 days" }),
    ).toHaveCount(0);
  });
});
