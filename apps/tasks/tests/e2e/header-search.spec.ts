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

  const { availableWidth, placeholderWidth } = await search.evaluate(
    (input) => {
      const searchInput = input as HTMLInputElement;
      const styles = getComputedStyle(searchInput);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      context.font = styles.font;
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

  await expect(
    page.getByRole("combobox", { name: "Search tasks" }),
  ).toHaveAttribute("placeholder", "Search tasks by title, ID, or project...");
});
