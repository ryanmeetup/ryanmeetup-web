import { expect, test, type Page } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";

async function enterDemo(page: Page, baseURL: string | undefined, query = "") {
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
  await page.goto(`/board${query}`);
  await expect(
    page.getByRole("button", { name: "Save view", exact: true }),
  ).toBeEnabled();
}

async function saveView(page: Page, name: string, asNew = false) {
  await page
    .getByRole("button", {
      name: asNew ? "Save as new" : "Save view",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", { name: "Save view", exact: true });
  await dialog.getByRole("textbox", { name: "View name" }).fill(name);
  await dialog.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function chooseView(page: Page, name: string) {
  await page.getByRole("button", { name: /^Views/ }).click();
  await page.getByRole("option", { name, exact: true }).click();
}

test("saved exclusions and layout survive reload and replace current filters", async ({
  page,
  baseURL,
}) => {
  await enterDemo(
    page,
    baseURL,
    "?excludeProjects=Website+Refresh&excludeCategories=Creative&view=list&sort=due",
  );
  await saveView(page, "Life improvements");
  await expect(page).toHaveURL(/savedView=Life/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /^Views.*Life improvements/ }),
  ).toBeVisible();
  await chooseView(page, "All tasks");
  await expect(page).not.toHaveURL(/excludeProjects=/);
  await expect(
    page
      .getByRole("group", { name: "Task layout" })
      .getByRole("button", { name: "Board" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/board?priority=urgent&q=temporary&page=3");
  await chooseView(page, "Life improvements");
  await expect
    .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
    .toMatchObject({
      savedView: "Life improvements",
      excludeProjects: "Website Refresh",
      excludeCategories: "Creative",
      view: "list",
      sort: "due",
    });
  expect(new URL(page.url()).searchParams.has("priority")).toBe(false);
  expect(new URL(page.url()).searchParams.has("q")).toBe(false);
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await expect(
    page
      .getByRole("group", { name: "Task layout" })
      .getByRole("button", { name: "List" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("changes are explicit, resettable, updatable, and can be saved as another view", async ({
  page,
  baseURL,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enterDemo(page, baseURL, "?excludeProjects=Website+Refresh");
  await saveView(page, "Immediate focus");
  const layout = page.getByRole("group", { name: "Task layout" });
  await layout.getByRole("button", { name: "List" }).click();
  await expect(page.getByText("Modified", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Saved view actions" }).click();
  await page.getByRole("menuitem", { name: "Reset changes" }).click();
  await expect(layout.getByRole("button", { name: "Board" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("Modified", { exact: true })).toHaveCount(0);
  await layout.getByRole("button", { name: "List" }).click();
  await page.getByRole("button", { name: "Saved view actions" }).click();
  await page
    .getByRole("menuitem", { name: "Save as new", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Save view", exact: true })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.getByRole("button", { name: "Update view", exact: true }).click();
  await expect(page.getByText("Modified", { exact: true })).toHaveCount(0);
  await saveView(page, "Focus list", true);
  await chooseView(page, "Immediate focus");
  await expect(layout.getByRole("button", { name: "List" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Saved view actions" }).click();
  await page.getByRole("menuitem", { name: "Manage saved views" }).click();
  await page
    .getByRole("button", { name: "Rename Immediate focus", exact: true })
    .click();
  const rename = page.getByRole("dialog", { name: "Rename view", exact: true });
  await rename.getByRole("textbox", { name: "View name" }).fill("Work on now");
  await rename.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Rename Work on now", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Work on now", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Delete view", exact: true })
    .getByRole("button", { name: "Delete view", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Rename Work on now", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await chooseView(page, "Focus list");
  await expect(page).toHaveURL(/savedView=Focus/);
  await layout.getByRole("button", { name: "Board" }).click();
  for (const width of [390, 1024, 1280, 1536]) {
    await page.setViewportSize({ width, height: 900 });
    const controls = page.getByRole("region", { name: "Saved task views" });
    await expect(
      controls.getByRole("button", { name: "Update view", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        controls.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      )
      .toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`saved-views-modified-${width}.png`),
    });
  }
});

test("save modal summarizes exclusions, validates names, and fits boundary widths in both themes", async ({
  page,
  baseURL,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enterDemo(
    page,
    baseURL,
    "?excludeCategories=Creative&excludeProjects=Website+Refresh",
  );
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme as "light" | "dark" });
    await page.evaluate((value) => {
      document.documentElement.classList.toggle("dark", value === "dark");
    }, theme);
    for (const width of [390, 1024, 1280, 1536]) {
      await page.setViewportSize({ width, height: 900 });
      const controls = page.getByRole("region", { name: "Saved task views" });
      const filterToggle = page.getByRole("button", { name: /^Filters/ });
      if ((await filterToggle.getAttribute("aria-expanded")) === "true")
        await filterToggle.click();
      await expect(
        controls.getByRole("button", { name: "Save view", exact: true }),
      ).toBeVisible();
      await expect
        .poll(() =>
          controls.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`saved-views-header-${theme}-${width}.png`),
      });
      await page
        .getByRole("button", { name: "Save view", exact: true })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Save view",
        exact: true,
      });
      await expect(
        dialog.getByRole("textbox", { name: "View name" }),
      ).toHaveAttribute("required", "");
      await expect(
        dialog.getByText("Exclude category", { exact: true }),
      ).toBeVisible();
      await expect(dialog.getByText("Creative", { exact: true })).toBeVisible();
      await expect(
        dialog.getByText("Website Refresh", { exact: true }),
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Save view", exact: true }),
      ).toBeDisabled();
      await expect
        .poll(() =>
          dialog.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`saved-views-${theme}-${width}.png`),
      });
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(filterToggle).toHaveAttribute("aria-expanded", "false");
    }
  }
});
