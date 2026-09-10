import { expect, test, type Page } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";
import { taskPath } from "../../lib/tasks/task-key";

// The build's own key builder, so these routes stay right whatever prefix the
// server under test was compiled with. See `playwright.config.ts`.
const editedTask = taskPath({ task_number: 5 });
const movedTask = taskPath({ task_number: 1 });

// These workflows all render the full demo workspace. Keeping them serial
// avoids three simultaneous cold hydrations obscuring the transition each test
// is meant to exercise.
test.describe.configure({ mode: "serial" });

async function enterDemoWorkspace(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
}

test("adds and removes contact methods in the person editor", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/contacts");
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("link", { name: "New Contact", exact: true }),
  ).toHaveAttribute("href", "/contacts/new");
  await expect(
    page.getByRole("button", { name: "New Contact", exact: true }),
  ).toHaveCount(0);

  await page
    .getByRole("link", { name: "Edit “The Lantern Room”", exact: true })
    .click();
  await expect(page).toHaveURL(/\/contacts\/the-lantern-room\/edit$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit Priya Raman", exact: true })
    .click();

  const personDialog = page.getByRole("dialog", { name: "Edit person" });
  await expect(
    personDialog.getByRole("heading", { name: "Edit person" }),
  ).toBeVisible();
  const emailGroup = personDialog.getByRole("group", {
    name: "Email addresses",
  });
  await expect(emailGroup.getByText("1", { exact: true })).toBeVisible();
  await emailGroup.getByRole("button", { name: "Add email" }).click();

  const emailInputs = emailGroup.locator('input[type="email"]');
  await expect(emailInputs).toHaveCount(2);
  await expect(emailInputs.nth(1)).toBeFocused();
  await expect(emailGroup.getByText("2", { exact: true })).toBeVisible();

  await emailGroup
    .getByRole("button", { name: "Remove email address" })
    .click();
  await expect(emailInputs).toHaveCount(1);
});

test("returns to the contact list as it was left", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/contacts");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Search contacts").fill("lantern");
  await expect(page).toHaveURL(/\/contacts\?contact-search=lantern$/);

  await page
    .getByRole("link", { name: "Edit “The Lantern Room”", exact: true })
    .click();
  await expect(page).toHaveURL(/\/contacts\/the-lantern-room\/edit$/);

  // The trail names where the editor sits; it goes to the directory itself.
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link"),
  ).toHaveAttribute("href", "/contacts");

  // No `?from=` in the editor URL: Cancel is the browser's own history entry,
  // so the list returns with the search it was left with.
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/contacts\?contact-search=lantern$/);
  await expect(page.getByLabel("Search contacts")).toHaveValue("lantern");
});

test("leaves a directly opened contact editor at the list", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/contacts/the-lantern-room/edit");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/contacts$/);
});

test("holds the contact save button until something changes", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/contacts/the-lantern-room/edit");
  await page.waitForLoadState("networkidle");

  const save = page.getByRole("button", { name: "Save changes" });
  await expect(save).toBeDisabled();
  // The disabled button hands its pointer events to the tooltip's wrapper,
  // which is what Playwright reports as intercepting the hover.
  await save.hover({ force: true });
  await expect(page.getByRole("tooltip")).toHaveText("No changes to save yet.");

  const notes = page.getByLabel("Description");
  await notes.fill(`${await notes.inputValue()} Holds the date.`);
  await expect(save).toBeEnabled();

  await save.click();
  await expect(page).toHaveURL(/\/contacts$/);
});

test("keeps stale board results inert while a search is pending", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/board");
  await page.waitForLoadState("networkidle");

  const search = page.getByRole("searchbox", {
    name: "Search In Progress tasks",
  });
  const column = page.locator("section").filter({
    has: page.getByRole("heading", { level: 2, name: "In Progress" }),
  });
  await expect(column.getByText("Confirm launch venue")).toBeVisible();

  await search.fill("nothing matches this task");
  expect(await search.getAttribute("aria-busy")).toBe("true");
  await expect(page.getByLabel("Filtering In Progress tasks")).toBeVisible();
  await expect(page.getByLabel("Clear In Progress search")).toBeHidden();
  await expect(column).toHaveAttribute("aria-busy", "true");
  await expect(column.getByText("Confirm launch venue")).toBeVisible();
  await expect(
    column.getByText("Confirm launch venue").locator(".."),
  ).toHaveCSS("pointer-events", "none");

  await expect(search).toHaveAttribute("aria-busy", "false");
  await expect(
    column.getByText("No In Progress tasks match this search."),
  ).toBeVisible();
  const clearSearch = page.getByLabel("Clear In Progress search");
  await expect(clearSearch).toBeVisible();
  await clearSearch.click();
  await expect(search).toHaveValue("");
});

test("keeps category tags subordinate across task surfaces", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/board");
  await page.waitForLoadState("networkidle");

  const categoryBadge = page.getByLabel("Product / Tools category; tags: Bug", {
    exact: true,
  });
  await expect(categoryBadge).toHaveText("Product / Tools");
  await expect(categoryBadge.getByText("Bug", { exact: true })).toHaveCount(0);
  await categoryBadge.hover();
  const tagTooltip = page.getByRole("tooltip");
  await expect(tagTooltip).toBeVisible();
  await expect(tagTooltip).toContainText("Tags");
  await expect(tagTooltip).toContainText("Bug");

  const multiCategoryCard = page
    .getByRole("button", { name: "Open Confirm launch venue", exact: true })
    .locator("..");
  const eventsBadge = multiCategoryCard.getByLabel(
    "Events category; no tags selected",
    { exact: true },
  );
  const marketingBadge = multiCategoryCard.getByLabel(
    "Marketing category; no tags selected",
    { exact: true },
  );
  const [eventsBox, marketingBox] = await Promise.all([
    eventsBadge.boundingBox(),
    marketingBadge.boundingBox(),
  ]);
  expect(eventsBox).not.toBeNull();
  expect(marketingBox).not.toBeNull();
  expect(Math.abs(eventsBox!.y - marketingBox!.y)).toBeLessThan(2);

  await eventsBadge.hover();
  await expect(
    page.getByRole("tooltip").filter({ hasText: "No tags selected" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });

  await page
    .getByRole("link", {
      name: "Go to Fix confirmation email copy details",
      exact: true,
    })
    .click();
  await page.waitForLoadState("networkidle");

  const categoriesSection = page
    .getByRole("main")
    .getByText("Categories", { exact: true })
    .locator("..");
  await expect(
    categoriesSection.getByText("Product / Tools", { exact: true }),
  ).toBeVisible();
  await expect(
    categoriesSection.getByText("Bug", { exact: true }),
  ).toBeVisible();
  await expect(
    categoriesSection.getByRole("list", {
      name: "Tags in Product / Tools",
      exact: true,
    }),
  ).toContainText("Bug");
});

test("preserves existing assignees when another person is added", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/board");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Open Confirm launch venue" }).click();
  const assignees = page.getByRole("button", { name: "Assignees" });
  await expect(assignees).toContainText("Taylor Brooks, Alex Morgan");
  await assignees.click();
  await page.getByRole("option", { name: "Jordan Lee" }).click();
  await assignees.click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Edit Task" })).toHaveCount(0);

  await page.getByRole("button", { name: "Open Confirm launch venue" }).click();
  await expect(page.getByRole("button", { name: "Assignees" })).toContainText(
    "Taylor Brooks, Alex Morgan +1",
  );
});

test("shows shared assignments in My Tasks", async ({ page, baseURL }) => {
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/board");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Mine" }).click();
  await expect(
    page.getByRole("button", { name: "Open Confirm launch venue" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Publish onboarding checklist" }),
  ).toHaveCount(0);
});

test("returns to the task after saving from the mobile editor", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${editedTask}/edit?from=${encodeURIComponent(editedTask)}`);
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(new RegExp(`${editedTask}$`));
  await expect(
    page.getByRole("heading", { name: "Confirm launch venue" }),
  ).toBeVisible();
});

test("names both statuses in task move activity", async ({ page, baseURL }) => {
  await enterDemoWorkspace(page, baseURL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(movedTask);
  await page.waitForLoadState("networkidle");

  const activity = page
    .getByRole("button", { name: /Activity/ })
    .locator("..")
    .locator("..");
  await expect(activity).toContainText("Alex Morgan moved the task");
  await expect(activity).toContainText("In Review");
  await expect(activity).toContainText("Done");
});

test("keeps the mobile duplicate editor open for create another", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${editedTask}/edit?from=${encodeURIComponent(editedTask)}`);
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Duplicate task" }).click();
  await page.getByRole("checkbox", { name: "Create another" }).check();
  await page.getByRole("button", { name: "Create task" }).click();

  await expect(page).toHaveURL(new RegExp(`${editedTask}/edit`));
  await expect(
    page.getByRole("heading", { name: "A new thing to do" }),
  ).toBeVisible();
});

test("keeps comments and activity out of task creation", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/task/new");
  await page.waitForLoadState("networkidle");

  const createForm = page.locator("form");
  await expect(createForm.getByText("Checklist and attachments")).toBeVisible();
  await createForm.getByRole("button", { name: /Task details/ }).click();
  await expect(
    createForm.getByText("Checklist", { exact: true }),
  ).toBeVisible();
  await expect(
    createForm.getByText("Attachments", { exact: true }),
  ).toBeVisible();
  await expect(createForm.getByText("Comments", { exact: true })).toHaveCount(
    0,
  );
  await expect(createForm.getByText("Activity", { exact: true })).toHaveCount(
    0,
  );
});

test("keeps form labels consistent with the Categories heading", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/task/new");
  await page.waitForLoadState("networkidle");

  const createForm = page.locator("form");
  const categories = createForm.locator("legend", { hasText: "Categories" });
  const comparedLabels = [
    createForm.locator('label[for="task-title"]'),
    createForm.locator('label[for="task-description"]'),
    createForm.locator("label", { hasText: "Status" }),
    createForm.locator(".date-field > span", { hasText: "Due date" }),
  ];
  const presentation = (element: Element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform,
    };
  };
  const preferredStyle = await categories.evaluate(presentation);

  for (const label of comparedLabels) {
    await expect(label).toHaveCount(1);
    expect(await label.evaluate(presentation)).toEqual(preferredStyle);
  }
});

test("keeps the task due date inside the create form on mobile", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/task/new");
  await page.waitForLoadState("networkidle");

  const dueDateField = page
    .locator("form .date-field")
    .filter({ hasText: "Due date" });
  const dueDateInput = dueDateField.locator('input[type="date"]');
  const titleInput = page.getByLabel("Task title");
  await expect(dueDateInput).toBeVisible();

  const bounds = await Promise.all([
    dueDateField.boundingBox(),
    dueDateInput.boundingBox(),
    titleInput.boundingBox(),
  ]);
  expect(bounds[0]).not.toBeNull();
  expect(bounds[1]).not.toBeNull();
  expect(bounds[2]).not.toBeNull();
  expect(bounds[1]!.x + bounds[1]!.width).toBeLessThanOrEqual(
    bounds[0]!.x + bounds[0]!.width + 1,
  );
  expect(bounds[1]!.x).toBeCloseTo(bounds[2]!.x, 0);
  expect(bounds[1]!.x + bounds[1]!.width).toBeCloseTo(
    bounds[2]!.x + bounds[2]!.width,
    0,
  );
  await expect(dueDateField).toHaveCSS("min-width", "0px");
  await expect(dueDateInput).toHaveCSS("min-width", "0px");

  // iOS Safari zooms the page when a focused text control is below 16px.
  await expect(titleInput).toHaveCSS("font-size", "16px");
  await expect(
    page.locator('[contenteditable="true"][aria-label="Description"]'),
  ).toHaveCSS("font-size", "16px");
  await expect(dueDateInput).toHaveCSS("font-size", "16px");

  // Safari can retain a phantom root scroll region after closing its keyboard.
  // Reproduce that geometry and verify the footer remains the reachable end.
  await page.evaluate(() => {
    const phantomSpace = document.createElement("div");
    phantomSpace.dataset.testPhantomScroll = "";
    phantomSpace.style.height = "300px";
    document.body.append(phantomSpace);
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await expect
    .poll(() =>
      page
        .locator(".tasks-footer")
        .evaluate((footer) =>
          Math.round(
            footer.getBoundingClientRect().bottom - window.innerHeight,
          ),
        ),
    )
    .toBe(0);
  await page.locator("[data-test-phantom-scroll]").evaluate((node) => {
    node.remove();
  });
});

test("updates category owners through the resource editor", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/categories");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Edit “Operations”" }).click();
  const editor = page.getByRole("dialog", { name: "Edit Operations" });
  await expect(
    editor.getByRole("heading", { name: "Edit Operations" }),
  ).toBeVisible();

  const owners = editor.getByRole("button", { name: /Category owners/ });
  await owners.click();
  await page.getByRole("option", { name: "Alex Morgan" }).click();
  await owners.click();
  const save = page.getByRole("button", { name: "Save changes", exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(
    page.getByRole("heading", { name: "Edit Operations" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Edit “Operations”" }).click();
  const reopened = page.getByRole("dialog", { name: "Edit Operations" });
  await expect(
    reopened.getByRole("button", { name: /Category owners/ }),
  ).toContainText("Alex Morgan");
});

test("saves and deletes a calendar item", async ({ page, baseURL }) => {
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/calendar");
  await page.waitForLoadState("networkidle");

  const title = `Coverage checkpoint ${Date.now()}`;
  await page.getByRole("button", { name: "Add to calendar" }).click();
  const createDialog = page.getByRole("dialog", {
    name: "Add to calendar",
  });
  await createDialog.getByLabel("Title").fill(title);
  await createDialog.getByRole("button", { name: "Save" }).click();
  await expect(createDialog).toBeHidden();
  const calendarItem = page
    .getByLabel("Calendar details")
    .getByRole("button", { name: title, exact: true });
  await expect(calendarItem).toBeVisible();

  await calendarItem.click();
  const editDialog = page.getByRole("dialog", {
    name: "Edit important date",
  });
  await editDialog.getByRole("button", { name: "Delete" }).click();
  await expect(editDialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toHaveCount(0);
});

test("requires a reason before a task can be declined", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/board");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Open Confirm launch venue" }).click();
  await expect(page.getByRole("heading", { name: "Edit Task" })).toBeVisible();

  const reason = page.getByLabel(/Why is this task moving to Will Not Do/);
  await expect(reason).toHaveCount(0);

  await page.getByRole("button", { name: /^Status/ }).click();
  await page.getByRole("option", { name: "Will Not Do" }).click();
  await expect(reason).toBeVisible();

  // An empty reason is caught by the field itself, whitespace by the editor.
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Edit Task" })).toBeVisible();

  await reason.fill("   ");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page
      .getByRole("status")
      .getByText("Add a reason before moving this task to Will Not Do."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Edit Task" })).toBeVisible();

  await reason.fill("The venue doubled its rate.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Edit Task" })).toHaveCount(0);

  // The reason is kept as a comment, and the task now sits in the status, so
  // editing it again does not ask for another one.
  await page
    .getByRole("link", { name: "Go to Confirm launch venue details" })
    .click();
  await expect(page.getByText("The venue doubled its rate.")).toBeVisible();
  await page.getByRole("button", { name: "Edit task" }).first().click();
  await expect(page.getByRole("heading", { name: "Edit Task" })).toBeVisible();
  await expect(reason).toHaveCount(0);
});

/**
 * Archived work used to be missing from search entirely, even when the query
 * was the exact task key, though the task's own URL still opened it. It is
 * findable now, and it sits under everything still live rather than competing
 * with it.
 */
test("finds archived tasks beneath the live search results", async ({
  page,
  baseURL,
}) => {
  await enterDemoWorkspace(page, baseURL);
  await page.goto("/board");

  // "launch" matches a live task by title and the archived one by project, so
  // the dropdown has to place both.
  await page.getByRole("combobox", { name: "Search tasks" }).fill("launch");

  const suggestions = page.getByRole("listbox", { name: "Task suggestions" });
  const archived = suggestions.getByRole("option", {
    name: /Print branded lanyards/,
  });
  await expect(
    suggestions.getByRole("option", { name: /Confirm launch venue/ }),
  ).toBeVisible();
  await expect(archived).toBeVisible();

  // Last of everything the dropdown offers, whatever else matched.
  const headings = suggestions.locator("section > p");
  await expect(headings.first()).not.toHaveText(/Archived tasks/);
  await expect(headings.last()).toHaveText(/Archived tasks/);

  await archived.click();
  await expect(page).toHaveURL(/\/task\/RMT-15/);
});
