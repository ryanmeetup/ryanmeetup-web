import { expect, test, type Page } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";

async function openDemoArchive(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
  await page.goto("/board");
  await page
    .getByRole("group", { name: "Task status" })
    .getByRole("button", { name: "Archive" })
    .click();
}

const monthName = /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/;

test("collapses a whole archive month on desktop and mobile", async ({
  page,
  baseURL,
}) => {
  await openDemoArchive(page, baseURL);

  const desktopMonth = page.getByRole("button", { name: monthName }).first();
  const label = await desktopMonth.innerText();
  const desktopPanel = page.locator(
    `[id="${await desktopMonth.getAttribute("aria-controls")}"]`,
  );
  await expect(desktopPanel.locator("tbody tr").first()).toBeVisible();
  await desktopMonth.click();
  await expect(desktopMonth).toHaveAttribute("aria-expanded", "false");
  await expect(desktopPanel).toHaveAttribute("aria-hidden", "true");
  await expect
    .poll(() => desktopPanel.evaluate((element) => element.getBoundingClientRect().height))
    .toBe(0);
  await desktopMonth.click();
  await expect(desktopPanel.locator("tbody tr").first()).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  const mobileMonth = page.getByRole("button", { name: label });
  const mobilePanel = page.locator(
    `[id="${await mobileMonth.getAttribute("aria-controls")}"]`,
  );
  await expect(mobilePanel.getByRole("button").first()).toBeVisible();
  await mobileMonth.click();
  await expect(mobileMonth).toHaveAttribute("aria-expanded", "false");
  await expect(mobilePanel).toHaveAttribute("aria-hidden", "true");
  await expect
    .poll(() => mobilePanel.evaluate((element) => element.getBoundingClientRect().height))
    .toBe(0);
  await mobileMonth.click();
  await expect(mobilePanel.getByRole("button").first()).toBeVisible();
});
