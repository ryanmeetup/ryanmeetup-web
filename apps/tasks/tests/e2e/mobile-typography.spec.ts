import { expect, test } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";

test("cards share a compact title scale across surfaces, themes and widths", async ({
  page,
  baseURL,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/board");
    await page.waitForLoadState("networkidle");
    const title = page.getByRole("heading", {
      level: 3,
      name: "Fix confirmation email copy",
    });
    await expect(title).toHaveCSS("font-size", "13px");
    await expect(title).toHaveCSS("line-height", "18px");
    await expect(page.locator("body")).toHaveCSS("font-size", "13px");
    const column = page.locator("[data-board-column]").first();
    await expect(column.locator("h2")).toHaveCSS("font-size", "11px");
    for (const dark of [true, false]) {
      await page.evaluate(
        (enabled) => document.documentElement.classList.toggle("dark", enabled),
        dark,
      );
      await expect(column).toHaveCSS(
        "background-color",
        dark ? "rgb(27, 27, 27)" : "rgb(231, 232, 229)",
      );
      await expect(title).toHaveCSS(
        "color",
        dark ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)",
      );
      await page.screenshot({
        path: testInfo.outputPath(`board-${width}-${dark ? "dark" : "light"}.png`),
      });
    }

    await page.goto("/board?view=list");
    await expect(
      page.getByText("Fix confirmation email copy", { exact: true }),
    ).toHaveCSS("font-size", "13px");

    await page.goto("/notes");
    const noteTitle = page.getByRole("heading", {
      level: 3,
      name: "Launch retro takeaways",
    });
    await expect(noteTitle).toHaveCSS("font-size", "13px");
    await noteTitle.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`notes-${width}.png`) });

    await page.goto("/projects");
    await expect(
      page.getByRole("main").getByText("Website Refresh", { exact: true }),
    ).toHaveCSS("font-size", "13px");
    await page.screenshot({ path: testInfo.outputPath(`projects-${width}.png`) });
  }
});

test("task form text stays compact and consistent across phone and desktop widths", async ({
  page,
  baseURL,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/task/new");
  const form = page.locator("#task-editor-form");
  const title = page.getByRole("textbox", { name: "Task title" });
  const description = page.locator(
    '[contenteditable="true"][aria-label="Description"]',
  );
  await expect(title).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("new-task-phone-empty.png"),
    fullPage: false,
  });
  await form.getByRole("button", { name: /^Status/ }).click();
  await page.getByRole("option", { name: "Will Not Do", exact: true }).click();
  const reason = form.locator("textarea#task-status-reason");
  await expect(reason).toBeVisible();
  await title.fill("A compact task title");
  await description.fill(
    "A description with the same text size as the other fields.",
  );
  await reason.fill("This work is no longer needed.");

  for (const width of [320, 390, 640, 1024, 1280, 1536]) {
    await page.setViewportSize({ width, height: 900 });
    for (const control of [
      title,
      description,
      reason,
      form.getByRole("button", { name: /^Status/ }),
      form.getByRole("button", { name: /^Priority/ }),
      form.getByRole("button", { name: /^Assignees/ }),
      form.locator('input[type="date"]'),
    ]) {
      await expect(control).toHaveCSS("font-size", "13px");
    }
    for (const label of [
      form.locator('label[for="task-title"]'),
      form.locator('label[for="task-description"]'),
      form.locator("label", { hasText: "Status" }).first(),
      form.locator("legend", { hasText: "Categories" }),
      form.locator(".date-field > span", { hasText: "Due date" }),
    ]) {
      await expect(label).toHaveCSS("font-size", "12px");
      await expect(label).toHaveCSS("line-height", "16px");
    }
    await expect(
      page.getByRole("heading", { name: "A new thing to do" }),
    ).toHaveCSS("font-size", width < 640 ? "20px" : "28px");
    await expect
      .poll(() =>
        form.evaluate((element) => element.scrollWidth <= element.clientWidth),
      )
      .toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath(`task-fields-${width}.png`),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.screenshot({
    path: testInfo.outputPath("task-fields-light-phone.png"),
    fullPage: true,
  });
  const viewport = await page
    .locator('meta[name="viewport"]')
    .getAttribute("content");
  expect(viewport).not.toMatch(
    /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\D|$)/,
  );
});

test("contact inputs, native textareas and field labels use the same phone scale", async ({
  page,
  baseURL,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
  await page.goto("/contacts/new");
  const name = page.getByRole("textbox", { name: "Contact name" });
  const description = page.getByRole("textbox", { name: "Description" });
  await expect(name).toBeVisible();
  await expect(name).toHaveCSS("font-size", "13px");
  await expect(description).toHaveCSS("font-size", "13px");
  await expect(page.getByRole("button", { name: /^Group/ })).toHaveCSS(
    "font-size",
    "13px",
  );
  const placeholderSize = await name.evaluate(
    (element) => getComputedStyle(element, "::placeholder").fontSize,
  );
  expect(placeholderSize).toBe("13px");
  await name.fill("A new contact");
  await description.fill("Native textareas stay the same size while typing.");
  await expect(description).toHaveCSS("font-size", "13px");
  await page.screenshot({
    path: testInfo.outputPath("contact-fields-phone.png"),
    fullPage: true,
  });
});
