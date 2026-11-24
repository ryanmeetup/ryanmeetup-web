import { expect, test, type Page } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";

test.beforeEach(async ({ page, baseURL }) => {
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
  await page.setViewportSize({ width: 1280, height: 900 });
});

async function chooseView(page: Page, view: "Cards" | "Table") {
  await page.getByRole("button", { name: /^View (Cards|Table)$/ }).click();
  await page.getByRole("option", { name: view, exact: true }).click();
}

test("switches layouts without losing search or category filters and reloads the chosen view", async ({
  page,
}) => {
  await page.goto("/notes");
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("table", { name: "Notes", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: /^Category/ }).click();
  await page.getByRole("option", { name: /^Events/ }).click();
  await page.getByLabel("Search notes").fill("lantern");
  await expect(page).toHaveURL(/note-search=lantern/);

  await chooseView(page, "Cards");
  const cards = page.getByRole("list", { name: "Note cards" });
  await expect(cards.getByRole("listitem")).toHaveCount(1);
  await expect(
    cards.getByRole("heading", { level: 3 }).getByRole("button"),
  ).toHaveText("Vendor shortlist");
  await expect(page.getByRole("table")).toHaveCount(0);

  await page.reload();
  await expect(
    cards.getByRole("heading", { level: 3 }).getByRole("button"),
  ).toHaveText("Vendor shortlist");
  await expect(page.getByLabel("Search notes")).toHaveValue("lantern");
  await expect(page.getByRole("button", { name: /^Category/ })).toContainText(
    "Events",
  );

  await chooseView(page, "Table");
  await expect(
    page
      .getByRole("table")
      .getByRole("heading", { level: 3 })
      .getByRole("button"),
  ).toHaveText("Vendor shortlist");
  await expect(page).not.toHaveURL(/note-view=/);
  await expect(page).toHaveURL(/note-category=Events/);
  await expect(page).toHaveURL(/note-search=lantern/);
});

test("card actions edit, archive, and restore the same note across views", async ({
  page,
}) => {
  await page.goto("/notes?note-view=cards");
  await page.waitForLoadState("networkidle");
  const actions = page.getByRole("button", {
    name: "More actions for “Launch retro takeaways”",
  });
  await actions.click();
  await expect(page.getByRole("menuitem")).toHaveText([
    "Convert to task",
    "Convert to project",
    "Edit note",
    "Archive note",
    "Delete note",
  ]);
  await page.getByRole("menuitem", { name: "Edit note" }).click();
  const editor = page.getByRole("dialog");
  await expect(editor.getByLabel("Note title")).toHaveValue(
    "Launch retro takeaways",
  );
  await editor.getByLabel("Note title").fill("Updated retro takeaways");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    editor.getByRole("heading", { name: "Updated retro takeaways" }),
  ).toBeVisible();
  await editor.getByRole("button", { name: "Close", exact: true }).click();

  const updatedActions = page.getByRole("button", {
    name: "More actions for “Updated retro takeaways”",
  });
  await updatedActions.click();
  await page.getByRole("menuitem", { name: "Archive note" }).click();
  await expect(updatedActions).toHaveCount(0);
  await page.getByRole("button", { name: "View archive", exact: true }).click();
  await updatedActions.click();
  await expect(page.getByRole("menuitem")).toHaveText([
    "Restore note",
    "Delete note",
  ]);
  await page.getByRole("menuitem", { name: "Restore note" }).click();
  await page.getByRole("button", { name: "View active", exact: true }).click();
  await chooseView(page, "Table");
  await expect(
    page
      .getByRole("table")
      .getByRole("heading", { level: 3, name: "Updated retro takeaways" }),
  ).toBeVisible();
});

test("cards open a note's page on phones and keep the layout on return", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/notes?note-view=cards");
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("list", { name: "Note cards" })
    .getByRole("link", { name: "Launch retro takeaways", exact: true })
    .click();
  await expect(page).toHaveURL(/\/notes\/note-launch-retro$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Launch retro takeaways" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole("list", { name: "Note cards" })).toBeVisible();
  await expect(page).toHaveURL(/note-view=cards/);
});
