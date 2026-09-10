import { expect, test } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";

test("keeps narrow dashboard metric labels on one line", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    {
      name: DEMO_PREVIEW_COOKIE,
      value: DEMO_PREVIEW_VALUE,
      url: baseURL ?? "http://127.0.0.1:3100",
    },
  ]);
  await page.goto("/");

  const dueSoonCard = page.getByRole("link", {
    name: "View due within 14 days",
  });
  const label = dueSoonCard.getByText("Due soon", { exact: true });
  const arrow = dueSoonCard.locator("[data-metric-link-arrow]");

  await expect(label).toHaveCSS("white-space", "nowrap");
  await expect(arrow).toHaveCount(1);

  const labelBox = await label.boundingBox();
  const arrowBox = await arrow.boundingBox();

  expect(labelBox).not.toBeNull();
  expect(arrowBox).not.toBeNull();
  expect(arrowBox!.y).toBeGreaterThan(labelBox!.y + labelBox!.height);
});
