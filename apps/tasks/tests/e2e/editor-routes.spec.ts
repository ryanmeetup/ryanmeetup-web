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
  {
    name: "edit note",
    href: "/notes/note-launch-retro/edit",
    parent: "Notes",
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

test("a note opens as its own page on a phone and edits in place", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/notes");
  await page.waitForLoadState("networkidle");

  await page
    .getByRole("link", { name: "Launch retro takeaways", exact: true })
    .click();
  await expect(page).toHaveURL(/\/notes\/note-launch-retro$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Launch retro takeaways" }),
  ).toBeVisible();
  const trail = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(trail.getByRole("link", { name: "Notes" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Close" })).toHaveCount(0);

  // Editing stays on the page, and the address follows so a reload keeps the mode.
  await page.getByRole("button", { name: "Edit note" }).click();
  await expect(page).toHaveURL(/\/notes\/note-launch-retro\/edit$/);
  await expect(page.getByLabel("Note title")).toHaveValue(
    "Launch retro takeaways",
  );
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/notes\/note-launch-retro$/);
});

test("a note opens in its dialog from sm up", async ({ page, baseURL }) => {
  await enterDemoWorkspace(page, baseURL);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/notes");
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("link", { name: "Launch retro takeaways", exact: true }),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "Launch retro takeaways", exact: true })
    .click();
  // The dialog element itself has no box; its heading shows it opened.
  await expect(
    page
      .getByRole("dialog", { name: "Launch retro takeaways" })
      .getByRole("heading", { name: "Launch retro takeaways" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/notes$/);
});

test("an unknown note has no page", async ({ page, baseURL }) => {
  await enterDemoWorkspace(page, baseURL);
  // The workspace's loading boundary streams first, so the not-found page
  // arrives as content rather than a 404 status.
  await page.goto("/notes/not-a-note");
  await expect(page.getByText("Wrong turn.", { exact: false })).toBeVisible();
});

test("reorders category tags and accepts more than 20", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/categories/operations/edit");
  await page.waitForLoadState("networkidle");

  const tags = page.locator("[data-tag-value]");
  await expect(tags).toHaveText(["Chicago", "New York", "Los Angeles"]);

  const chicagoHandle = page.getByRole("button", {
    name: "Drag to reorder “Chicago”",
  });
  // dnd-kit's keyboard sensor listens for arrows only a tick after Space picks
  // a tag up, so an arrow pressed straight away is dropped. Press until its
  // live region confirms Chicago is over New York, never moving it twice.
  const overNewYork = page
    .locator('[id^="DndLiveRegion"]')
    .filter({ hasText: "Chicago was moved over droppable area New York" });
  await chicagoHandle.press("Space");
  await expect(async () => {
    if ((await overNewYork.count()) === 0) {
      await chicagoHandle.press("ArrowRight");
    }
    await expect(overNewYork).toHaveCount(1, { timeout: 1000 });
  }).toPass();
  await chicagoHandle.press("Space");
  await expect(tags).toHaveText(["New York", "Chicago", "Los Angeles"]);

  const tagInput = page.getByLabel("Tags");
  for (let index = 1; index <= 18; index += 1) {
    await tagInput.fill(`Extra ${index}`);
    await tagInput.press("Enter");
  }
  await expect(tags).toHaveCount(21);
  await expect(tagInput).toBeEnabled();
  await expect(page.getByText("21/20", { exact: false })).toHaveCount(0);
});

test("returns from new task through browser history without a from parameter", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/board?view=list");
  await page.waitForLoadState("networkidle");

  // On a phone the header's + is a menu of everything this person can create.
  await page.getByRole("button", { name: "Create new" }).click();
  await expect(
    page.getByRole("menuitem", { name: "New project" }),
  ).toHaveAttribute("href", /^\/projects\/new\?from=/);
  await expect(
    page.getByRole("menuitem", { name: "New category" }),
  ).toHaveAttribute("href", /^\/categories\/new\?from=/);
  const newTask = page.getByRole("menuitem", { name: "New task" });
  await expect(newTask).toHaveAttribute("href", "/task/new");
  await newTask.click();
  await expect(page).toHaveURL(/\/task\/new$/);

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/board\?view=list$/);
});

test("creates projects and categories from the header's New menu on desktop", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/board");
  await page.waitForLoadState("networkidle");

  const trigger = page.getByRole("button", { name: "Create new" });
  await expect(trigger).toContainText("New");
  await trigger.click();
  for (const name of ["New task", "New project", "New category"])
    await expect(page.getByRole("menuitem", { name })).toBeVisible();
  // From `sm` up the default preference opens the dialog, not the route.
  await page.getByRole("menuitem", { name: "New project" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "New project" })
      .getByRole("heading", { name: "New Project" }),
  ).toBeVisible();
});

test("offers every create option on pages without their own create dialogs", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const path of ["/notes", "/contacts", "/calendar", "/changelog"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Create new" }).click();
    for (const name of ["New task", "New project", "New category"])
      await expect(page.getByRole("menuitem", { name })).toBeVisible();
    await page.keyboard.press("Escape");
  }

  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByRole("menuitem", { name: "New project" }).click();
  await expect(page.getByRole("dialog", { name: "New project" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByRole("menuitem", { name: "New category" }).click();
  await expect(page.getByRole("dialog", { name: "New category" })).toBeVisible();
});

test("returns a directly opened new task page to the board", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/task/new");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/board$/);
});

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
