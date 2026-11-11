import { expect, test } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";
import { taskPath } from "../../lib/tasks/task-key";

for (const width of [390, 1280]) {
  test(`adds task links once and removes only the chosen attachment at ${width}px`, async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.context().addCookies([
      {
        name: DEMO_PREVIEW_COOKIE,
        value: DEMO_PREVIEW_VALUE,
        url: baseURL ?? "http://127.0.0.1:3100",
      },
    ]);
    await page.goto(taskPath({ task_number: 5 }));
    const url = page.getByRole("textbox", { name: "Attachment URL" });

    await url.fill("example.com/brief");
    await page.getByRole("button", { name: "Add URL", exact: true }).click();
    await expect(url).toHaveValue("");
    await expect(
      page.getByRole("link", { name: "Open brief in a new tab" }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("link", { name: "Open brief in a new tab" }),
    ).toHaveAttribute("href", "https://example.com/brief");

    await url.fill("https://example.com/notes");
    await url.press("Enter");
    await expect(url).toHaveValue("");
    await expect(
      page.getByRole("link", { name: "Open notes in a new tab" }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("link", { name: "Open brief in a new tab" }),
    ).toHaveCount(1);

    await page
      .getByRole("button", { name: "Remove “brief”", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Open brief in a new tab" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Open notes in a new tab" }),
    ).toHaveCount(1);

    await page.reload();
    await expect(
      page.getByRole("link", { name: "Open brief in a new tab" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Open notes in a new tab" }),
    ).toHaveCount(1);
  });
}
