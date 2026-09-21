import { expect, test, type Page } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";

async function enterDemoWorkspace(page: Page, baseURL?: string) {
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
}

test("completed projects leave Current and remain available to archive", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/projects");

  await page.getByRole("button", { name: "New project" }).click();
  const editor = page.getByRole("dialog", { name: "New project" });
  await editor
    .getByRole("textbox", { name: "Project name" })
    .fill("Finished launch");
  await editor
    .getByRole("textbox", { name: "Description" })
    .fill("Launch work is done.");
  await editor.getByRole("button", { name: "Project status" }).click();
  await page.getByRole("option", { name: "Complete" }).click();
  await editor.getByRole("button", { name: "Create project" }).click();

  const filters = page.getByLabel("Filter projects");
  const results = page.locator("main");
  await expect(
    filters.getByRole("button", { name: "Current" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    results.getByText("Finished launch", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator("[data-workspace-sidebar]").getByRole("link", {
      name: "Complete project Finished launch",
    }),
  ).toHaveCount(0);

  await filters.getByRole("button", { name: "Completed" }).click();
  await expect(
    results.getByText("Finished launch", { exact: true }),
  ).toBeVisible();

  await results
    .getByRole("button", { name: "Archive “Finished launch”" })
    .click();
  await expect(
    results.getByText("Finished launch", { exact: true }),
  ).toHaveCount(0);
  await filters.getByRole("button", { name: "Archived" }).click();
  await expect(
    results.getByText("Finished launch", { exact: true }),
  ).toBeVisible();
});

test("completing a favorite removes it from the sidebar", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/projects");

  const sidebar = page.locator("[data-workspace-sidebar]");
  await expect(
    sidebar.getByRole("link", { name: "Active project Website Refresh" }),
  ).toBeVisible();

  await page
    .locator("main")
    .getByRole("button", { name: "Edit “Website Refresh”" })
    .click();
  const editor = page.getByRole("dialog", { name: "Edit Website Refresh" });
  await editor.getByRole("button", { name: "Project status" }).click();
  await page.getByRole("option", { name: "Complete" }).click();
  await editor.getByRole("button", { name: "Save changes" }).click();

  await expect(
    sidebar.getByRole("link", { name: "Complete project Website Refresh" }),
  ).toHaveCount(0);
  await expect(sidebar.getByRole("button", { name: "Favorites" })).toHaveCount(
    0,
  );
  await page
    .getByLabel("Filter projects")
    .getByRole("button", { name: "Completed" })
    .click();
  await expect(
    page.locator("main").getByText("Website Refresh", { exact: true }),
  ).toBeVisible();
});

test("all project filters fit at mobile and desktop widths", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/projects");

  const filters = page.getByLabel("Filter projects");
  for (const width of [390, 1024, 1280, 1536]) {
    await page.setViewportSize({ width, height: 844 });
    for (const label of ["Current", "Completed", "Archived", "All"]) {
      await expect(filters.getByRole("button", { name: label })).toBeVisible();
    }
    // Poll rather than measure once: a resize reflows the row over the next
    // few frames, and mid-reflow it is briefly narrower than it settles at.
    await expect
      .poll(
        async () =>
          filters.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        { message: `filters fit at ${width}px` },
      )
      .toBe(true);
  }
});
