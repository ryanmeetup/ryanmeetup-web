import { expect, test } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";

test("opens an upward project menu with favorites in view", async ({
  page,
  baseURL,
}) => {
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/board");
  await page.waitForLoadState("networkidle");

  await page.evaluate(() => {
    const storageKey = "ryanmeetup.tasks.workspace.v2";
    const workspace = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (!workspace?.projects?.[0])
      throw new Error("Demo workspace unavailable");

    const seed = workspace.projects[0];
    const extraProjects = Array.from({ length: 18 }, (_, index) => ({
      ...seed,
      id: `scroll-project-${index + 1}`,
      name: `Scroll project ${String(index + 1).padStart(2, "0")}`,
    }));
    workspace.projects = [...workspace.projects, ...extraProjects];
    workspace.currentProfile.favorite_project_ids = extraProjects
      .slice(-3)
      .map((project: { id: string }) => project.id);
    localStorage.setItem(storageKey, JSON.stringify(workspace));
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Open Confirm launch venue" }).click();
  const editor = page.getByRole("dialog", { name: "Edit Task" });

  const projectSelect = editor.getByLabel("Project", { exact: true });
  await projectSelect.evaluate((element) =>
    element.scrollIntoView({ block: "end" }),
  );
  await projectSelect.click();

  const options = page.getByRole("listbox");
  await expect(options).toHaveAttribute("data-anchor", /top/);
  const scrollRegion = options.locator(".overflow-y-auto");
  await expect
    .poll(() => scrollRegion.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await expect(
    options.getByText("Favorites", { exact: true }),
  ).toBeInViewport();
  await expect(
    options.getByRole("option", { name: "Scroll project 16" }),
  ).toBeInViewport();
  await expect(
    options.getByRole("option", { name: "Scroll project 18" }),
  ).toBeInViewport();
});
