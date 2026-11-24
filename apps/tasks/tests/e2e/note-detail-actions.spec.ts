import { expect, test, type Page } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";

const title = "Launch retro takeaways";

for (const surface of ["dialog", "page"] as const) {
  test.describe(`note detail ${surface}`, () => {
    test.beforeEach(async ({ page, baseURL }) => {
      await page.context().addCookies([
        {
          name: DEMO_PREVIEW_COOKIE,
          value: DEMO_PREVIEW_VALUE,
          url: baseURL ?? "http://127.0.0.1:3100",
        },
      ]);
      await page.setViewportSize({
        width: surface === "page" ? 390 : 1280,
        height: 900,
      });
      await page.goto(
        surface === "page" ? "/notes/note-launch-retro" : "/notes",
      );
      await page.waitForLoadState("networkidle");
      if (surface === "dialog")
        await page.getByRole("button", { name: title, exact: true }).click();
    });

    const details = (page: Page) =>
      surface === "dialog"
        ? page.getByRole("dialog", { name: title, exact: true })
        : page.locator("[data-editor-page]");
    const openActions = async (page: Page) => {
      await details(page)
        .getByRole("button", { name: `More actions for “${title}”` })
        .click();
    };

    test("edits, archives, restores, and confirms deletion from the detail view", async ({
      page,
    }) => {
      await openActions(page);
      await expect(page.getByRole("menuitem")).toHaveText([
        "Convert to task",
        "Convert to project",
        "Edit note",
        "Archive note",
        "Delete note",
      ]);
      await page.getByRole("menuitem", { name: "Edit note" }).click();
      await expect(page.getByLabel("Note title")).toHaveValue(title);
      if (surface === "page")
        await expect(page).toHaveURL(/\/notes\/note-launch-retro\/edit$/);
      await page.getByRole("button", { name: "Cancel", exact: true }).click();

      await openActions(page);
      await page.getByRole("menuitem", { name: "Archive note" }).click();
      await expect(
        details(page).getByRole("button", { name: "Edit note", exact: true }),
      ).toHaveCount(0);
      await openActions(page);
      await expect(page.getByRole("menuitem")).toHaveText([
        "Restore note",
        "Delete note",
      ]);
      await page.getByRole("menuitem", { name: "Restore note" }).click();
      await expect(
        details(page).getByRole("button", { name: "Edit note", exact: true }),
      ).toBeVisible();

      await openActions(page);
      await page.getByRole("menuitem", { name: "Delete note" }).click();
      const confirmation = page.getByRole("dialog", {
        name: "Delete this note?",
      });
      await confirmation
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      await expect(
        details(page).getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await openActions(page);
      await page.getByRole("menuitem", { name: "Delete note" }).click();
      await confirmation
        .getByRole("button", { name: "Delete note", exact: true })
        .click();
      await expect(page).toHaveURL(/\/notes$/);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      if (surface === "dialog")
        await expect(
          page.getByRole("heading", { level: 3, name: title }),
        ).toHaveCount(0);
    });

    test("converts the open note into a project and updates its available actions", async ({
      page,
    }) => {
      await openActions(page);
      await page.getByRole("menuitem", { name: "Convert to project" }).click();
      const project = page.getByRole("dialog", {
        name: "New Project",
        exact: true,
      });
      await expect(project.getByLabel(/^Project name/)).toHaveValue(title);
      await project
        .getByRole("button", { name: "Create project", exact: true })
        .click();
      await expect(project).toHaveCount(0);
      await expect(
        details(page).getByRole("link", { name: title, exact: true }),
      ).toBeVisible();
      await openActions(page);
      await expect(page.getByRole("menuitem")).toHaveText([
        "Edit note",
        "Archive note",
        "Delete note",
      ]);
    });

    test("cancels task conversion without losing the note, then creates the task", async ({
      page,
    }) => {
      await openActions(page);
      await page.getByRole("menuitem", { name: "Convert to task" }).click();
      const task = page.getByRole("dialog", {
        name: "A new thing to do",
        exact: true,
      });
      await expect(task.getByLabel(/^Task title/)).toHaveValue(title);
      await task.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(task).toHaveCount(0);
      await expect(
        details(page).getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await openActions(page);
      await page.getByRole("menuitem", { name: "Convert to task" }).click();
      await task
        .getByRole("button", { name: "Create task", exact: true })
        .click();
      await expect(page).toHaveURL(/\/task\/[^/]+$/);
      // The demo server only resolves seeded task detail pages. Check the
      // conversion result and destination independently of that limitation.
      await expect(
        page.getByText("Note converted to a task and deleted.", {
          exact: true,
        }),
      ).toBeVisible();
    });
  });
}
