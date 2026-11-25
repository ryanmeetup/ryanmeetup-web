import { expect, test } from "@playwright/test";
import {
  DEMO_PREVIEW_COOKIE,
  DEMO_PREVIEW_VALUE,
} from "../../lib/demo-preview";
import { taskPath } from "../../lib/tasks/task-key";

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1536, height: 960 },
]) {
  for (const taskNumber of [3, 4]) {
    test(`assigns task ${taskNumber} to me at ${viewport.width}px without removing other assignees`, async ({
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
      await page.setViewportSize(viewport);
      await page.goto(taskPath({ task_number: taskNumber }));
      await page.waitForLoadState("networkidle");

      const details = page
        .getByRole("heading", { name: "Task details", exact: true })
        .locator("..");
      const assignees = details
        .getByText("Assignees", { exact: true })
        .locator("..");
      if (taskNumber === 4) {
        await expect(assignees).toContainText("Jordan Lee");
        await expect(assignees).toContainText("Alex Morgan");
      }

      await assignees
        .getByRole("button", { name: "Assign to me", exact: true })
        .click();
      await expect(assignees).toContainText("Taylor Brooks");
      await expect(assignees).not.toContainText("Unassigned");
      await expect(
        page.getByRole("button", { name: "Assign to me", exact: true }),
      ).toHaveCount(0);
      if (taskNumber === 4) {
        await expect(assignees).toContainText("Jordan Lee");
        await expect(assignees).toContainText("Alex Morgan");
      }

      await page.reload();
      await expect(assignees).toContainText("Taylor Brooks");
      await expect(
        page.getByRole("button", { name: "Assign to me", exact: true }),
      ).toHaveCount(0);
    });
  }
}
