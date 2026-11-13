import { expect, test } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";

test("readable task URLs retain every selected status and priority", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([
      {
        name: DEMO_PREVIEW_COOKIE,
        value: DEMO_PREVIEW_VALUE,
        url: baseURL ?? "http://127.0.0.1:3100",
      },
    ]);
  await page.goto("/board?status=todo,progress&priority=high,low");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("status"))
    .toBe("Todo,In Progress");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("priority"))
    .toBe("High,Low");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "All Tasks", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("status")).toBe(
    "Todo,In Progress",
  );
  expect(new URL(page.url()).searchParams.get("priority")).toBe("High,Low");
});
