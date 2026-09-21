import { expect, test } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";

test("keeps the header search placeholder readable on narrow screens", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
  await page.goto("/");

  const search = page.getByRole("combobox", { name: "Search tasks" });
  await expect(search).toHaveAttribute("placeholder", "Search tasks…");
  await expect(search).toHaveCSS("font-size", "16px");
  await expect(search).toHaveCSS("height", "32px");
  const placeholderFontSize = () =>
    search.evaluate(
      (input) => getComputedStyle(input, "::placeholder").fontSize,
    );
  expect(await placeholderFontSize()).toBe("14px");

  const { availableWidth, placeholderWidth } = await search.evaluate(
    (input) => {
      const searchInput = input as HTMLInputElement;
      const styles = getComputedStyle(searchInput);
      const placeholderStyles = getComputedStyle(searchInput, "::placeholder");
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      context.font = placeholderStyles.font;
      return {
        availableWidth:
          searchInput.clientWidth -
          parseFloat(styles.paddingLeft) -
          parseFloat(styles.paddingRight),
        placeholderWidth: context.measureText(searchInput.placeholder).width,
      };
    },
  );

  expect(placeholderWidth).toBeLessThan(availableWidth);

  await search.focus();
  await expect(search).toHaveCSS("font-size", "16px");
  expect(await placeholderFontSize()).toBe("14px");
});

test("explains what task search supports on desktop screens", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
  await page.goto("/");

  const search = page.getByRole("combobox", { name: "Search tasks" });
  await expect(search).toHaveAttribute(
    "placeholder",
    "Search tasks by title, ID, or project...",
  );
  await expect(search).toHaveCSS("font-size", "14px");
  await expect(search).toHaveCSS("height", "40px");
});

test("shows a project's lifecycle status in search results", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
  await page.goto("/");

  await page
    .getByRole("combobox", { name: "Search tasks" })
    .fill("Website Refresh");

  const projectResult = page
    .getByRole("listbox", { name: "Task suggestions" })
    .getByRole("link")
    .filter({ hasText: "Website Refresh" });
  await expect(projectResult).toBeVisible();
  await expect(
    projectResult.getByText("Active", { exact: true }),
  ).toBeVisible();

  const taskResult = page
    .getByRole("listbox", { name: "Task suggestions" })
    .getByRole("option")
    .filter({ hasText: "Refresh partner brief" });
  await expect(
    taskResult.getByText("In Review", { exact: true }),
  ).toBeVisible();
  await expect(taskResult.locator("i")).toHaveCSS(
    "background-color",
    "rgb(124, 58, 237)",
  );
});
