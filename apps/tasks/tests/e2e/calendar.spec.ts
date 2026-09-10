import { expect, test, type Page } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";
import { moveCalendarMonth } from "../../lib/calendar/calendar-view";
import { demoData } from "../../lib/workspace/demo-data";

async function openDemoCalendar(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
  await page.goto("/calendar");
}

test("opens the important-date editor from the calendar", async ({
  page,
  baseURL,
}) => {
  await openDemoCalendar(page, baseURL);

  await expect(page.locator("[data-calendar-month-grid]")).toBeVisible();
  await page
    .getByRole("button", { name: "Add to calendar", exact: true })
    .click();

  const editor = page.getByRole("dialog", { name: "Add to calendar" });
  await expect(
    editor.getByRole("heading", { name: "Add to calendar" }),
  ).toBeVisible();
  await expect(
    editor.getByRole("button", { name: /What are you adding\?/ }),
  ).toContainText("Important date");
  await expect(editor.getByLabel("Title")).toBeVisible();
  await expect(editor.getByLabel("Start date")).toBeVisible();
  await expect(editor.getByLabel("End date")).toBeVisible();
  await expect(editor.getByRole("checkbox", { name: "All day" })).toBeChecked();
});

test("switches the one editor between a date and time away", async ({
  page,
  baseURL,
}) => {
  await openDemoCalendar(page, baseURL);

  await page
    .getByRole("button", { name: "Add to calendar", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: "Add to calendar" });
  await expect(
    editor.getByRole("button", { name: "Visibility" }),
  ).toBeVisible();

  await editor.getByRole("button", { name: /What are you adding\?/ }).click();
  await page.getByRole("option", { name: "Time away" }).click();

  await expect(
    editor.getByRole("button", { name: /Who will be away\?/ }),
  ).toBeVisible();
  await expect(editor.getByLabel("Title")).toHaveValue("Out of office");
  await expect(editor.getByRole("button", { name: "Visibility" })).toBeHidden();
});

test("shows explicit project milestones in the month grid", async ({
  page,
  baseURL,
}) => {
  const project = demoData.projects.find(
    (candidate) => candidate.id === "website-refresh",
  );
  if (!project?.due_date) throw new Error("Demo project needs a due date.");

  await openDemoCalendar(page, baseURL);
  let visibleMonth = new Date().toISOString().slice(0, 7);
  const dueMonth = project.due_date.slice(0, 7);
  const direction = dueMonth > visibleMonth ? 1 : -1;
  const monthButton = page.getByRole("button", {
    name: direction === 1 ? "Next month" : "Previous month",
  });
  while (visibleMonth !== dueMonth) {
    await monthButton.click();
    visibleMonth = moveCalendarMonth(visibleMonth, direction);
  }

  const milestone = page
    .locator("[data-calendar-month-grid]")
    .locator('a[href="/projects/website-refresh"]', {
      hasText: "Project due",
    });
  await expect(milestone).toHaveCount(1);
  await expect(milestone).toContainText("Website Refresh");
});

test.describe("mobile calendar", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("uses the agenda presentation instead of the month grid", async ({
    page,
    baseURL,
  }) => {
    await openDemoCalendar(page, baseURL);

    await expect(page.locator("[data-calendar-month-grid]")).toBeHidden();
    await expect(page.locator("[data-calendar-mobile-agenda]")).toBeVisible();
    // A phone gets the route trigger; the dialog trigger beside it stays
    // hidden until `sm`. See `components/global/editor-routes.ts`.
    await expect(
      page.getByRole("link", { name: "Add to calendar", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to calendar", exact: true }),
    ).toBeHidden();
  });
});
