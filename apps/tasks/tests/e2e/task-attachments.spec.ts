import { expect, test, type Page } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";
import { taskPath } from "../../lib/tasks/task-key";

async function enterDemo(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
}

async function addLink(page: Page, url: string, title: string) {
  await page
    .getByRole("textbox", { name: "Link title", exact: true })
    .fill(title);
  await page
    .getByRole("textbox", { name: "Attachment URL", exact: true })
    .fill(url);
  await page.getByRole("button", { name: "Add URL", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Attachment URL", exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("textbox", { name: "Link title", exact: true }),
  ).toHaveValue("");
}

const previewImage = "https://preview.example.test/card.png";
const missingImage = "https://preview.example.test/missing.png";

async function mockPreviews(page: Page) {
  await page.route("**/api/link-preview?**", (route) => {
    const url = new URL(route.request().url()).searchParams.get("url");
    return route.fulfill({
      json: {
        imageUrl: url?.endsWith("/broken")
          ? missingImage
          : url?.endsWith("/plain")
            ? null
            : previewImage,
      },
    });
  });
  await page.route(previewImage, (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.route(missingImage, (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
}

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

for (const width of [390, 1024, 1280, 1536]) {
  test(`keeps a chosen link title and shows preview images with icon fallbacks at ${width}px`, async ({
    page,
    baseURL,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(
      (theme) => localStorage.setItem("theme", theme),
      width === 1024 || width === 1536 ? "dark" : "light",
    );
    await enterDemo(page, baseURL);
    await mockPreviews(page);
    await page.goto(taskPath({ task_number: 5 }));

    await addLink(page, "example.com/123", "Launch plan");
    await expect(
      page.getByRole("link", {
        name: "Open Launch plan in a new tab",
        exact: true,
      }),
    ).toHaveAttribute("href", "https://example.com/123");
    const image = page.locator(`img[src="${previewImage}"]`);
    await expect(image).toBeVisible();
    await expect(image).toHaveJSProperty("naturalWidth", 1);

    await page
      .getByRole("textbox", { name: "Link title", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("titled-link.png") });

    const imageFailed = page.waitForResponse(missingImage);
    await addLink(page, "example.com/broken", "Broken preview");
    await imageFailed;
    const brokenRow = page
      .getByText("Broken preview", { exact: true })
      .locator("..")
      .locator("..");
    await expect(brokenRow.locator("img")).toHaveCount(0);
    await expect(
      brokenRow.locator('span[aria-hidden="true"] > svg'),
    ).toBeVisible();

    const plainPreview = page.waitForResponse(
      (response) =>
        response.url().includes("/api/link-preview?") &&
        response.url().includes("plain"),
    );
    await addLink(page, "example.com/plain", "Plain page");
    await plainPreview;
    const plainRow = page
      .getByText("Plain page", { exact: true })
      .locator("..")
      .locator("..");
    await expect(plainRow.locator("img")).toHaveCount(0);
    await expect(
      plainRow.locator('span[aria-hidden="true"] > svg'),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("link", {
        name: "Open Launch plan in a new tab",
        exact: true,
      }),
    ).toHaveCount(1);
    await expect(page.locator(`img[src="${previewImage}"]`)).toBeVisible();
  });
}

test("keeps a chosen attachment title when creating a task", async ({
  page,
  baseURL,
}) => {
  await enterDemo(page, baseURL);
  await mockPreviews(page);
  await page.goto("/task/new");
  await page.waitForLoadState("networkidle");
  const taskTitle = "A task with a titled reference";
  await page.getByLabel("Task title").fill(taskTitle);
  const category = page.getByRole("checkbox", {
    name: "Operations",
    exact: true,
  });
  await category.locator("..").click();
  await expect(category).toBeChecked();
  await page.getByRole("button", { name: /Task details/ }).click();
  await addLink(page, "example.com/456", "Reference docs");
  await expect(page.getByText("Reference docs", { exact: true })).toBeVisible();
  await expect(page.locator(`img[src="${previewImage}"]`)).toBeVisible();
  await page.getByRole("button", { name: "Create task", exact: true }).click();

  const savedAttachment = () =>
    page.evaluate((title) => {
      const raw = localStorage.getItem("ryanmeetup.tasks.workspace.v2");
      const data = raw
        ? (JSON.parse(raw) as {
            tasks: { id: string; title: string }[];
            attachments: { task_id: string; name: string; url: string }[];
          })
        : null;
      const taskId = data?.tasks.find((task) => task.title === title)?.id;
      return (
        data?.attachments.find((attachment) => attachment.task_id === taskId) ??
        null
      );
    }, taskTitle);
  await expect
    .poll(savedAttachment)
    .toMatchObject({ name: "Reference docs", url: "https://example.com/456" });
  // Demo-created tasks live in browser storage; reopen through the board.
  await page.goto("/board");
  await page
    .getByRole("button", { name: `Open ${taskTitle}`, exact: true })
    .click();
  const link = page.getByRole("link", {
    name: "Open Reference docs in a new tab",
    exact: true,
  });
  if (!(await link.isVisible()))
    await page.getByRole("button", { name: /Task details/ }).click();
  await expect(link).toHaveAttribute("href", "https://example.com/456");
});
