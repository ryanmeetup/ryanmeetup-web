import { expect, test, type Page } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";
import { taskPath } from "../../lib/tasks/task-key";

/**
 * The dedicated create/edit routes are pages, not dialogs that happen to have a
 * URL. See `docs/MOBILE_EDITOR_SURFACES.md`.
 *
 * These assertions are deliberately structural rather than visual: a route that
 * regressed to the dialog chrome would lose its breadcrumb trail and its `h1`
 * and gain a "Close" control, and that is exactly what is checked. Contacts is
 * in the list as the reference the other four were built to match.
 */
const editedTask = taskPath({ task_number: 5 });

const editorRoutes: { name: string; href: string; parent: string }[] = [
  { name: "new contact", href: "/contacts/new", parent: "Contacts" },
  {
    name: "edit contact",
    href: "/contacts/the-lantern-room/edit",
    parent: "Contacts",
  },
  { name: "new task", href: "/task/new", parent: "Board" },
  { name: "edit task", href: `${editedTask}/edit`, parent: "Board" },
  { name: "new project", href: "/projects/new", parent: "Projects" },
  {
    name: "edit project",
    href: "/projects/website-refresh/edit",
    parent: "Projects",
  },
  { name: "new category", href: "/categories/new", parent: "Categories" },
  {
    name: "edit category",
    href: "/categories/operations/edit",
    parent: "Categories",
  },
  {
    name: "new calendar event",
    href: "/calendar/event/new",
    parent: "Calendar",
  },
  {
    name: "edit calendar event",
    href: "/calendar/event/demo-away/edit",
    parent: "Calendar",
  },
];

async function enterDemoWorkspace(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
}

for (const route of editorRoutes) {
  test(`${route.name} renders as a page, not a dialog`, async ({
    page,
    baseURL,
  }) => {
    await enterDemoWorkspace(page, baseURL);
    // A phone is the viewport these routes exist for.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route.href);
    await page.waitForLoadState("networkidle");

    const trail = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(trail.getByRole("link", { name: route.parent })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // The form is the page, so nothing renders it as a dialog and nothing
    // offers the close control a dialog needs.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Close" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  });
}

/**
 * Supporting details open into a second column beside the form. The dialog
 * widens its card for that; the page has to widen its own column, or the two
 * columns are crushed into the width one column needed. `EditorPageSurface`
 * reads the same `size` the dialog does — this is the assertion that it still
 * does.
 *
 * The task editor is the only one left that makes the gesture. The project
 * editor used to be here too, until its links, notes, and files moved out of a
 * "Supporting details" disclosure and onto the overview as `ProjectContextCard`
 * — the page form it left behind is one narrow column at every size.
 */
test("task editor page widens when its details open", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.setViewportSize({ width: 1800, height: 1000 });
  await page.goto("/task/new");
  await page.waitForLoadState("networkidle");

  const column = page.locator("[data-editor-page]");
  const collapsed = (await column.boundingBox())?.width ?? 0;
  expect(collapsed).toBeGreaterThan(0);

  await page.getByRole("button", { name: /Task details/ }).click();
  // The column animates its max-width; wait for it to settle rather than
  // sampling mid-transition.
  await expect
    .poll(async () => (await column.boundingBox())?.width ?? 0)
    .toBeGreaterThan(collapsed + 100);
});
