import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { DEMO_PREVIEW_COOKIE, DEMO_PREVIEW_VALUE } from "../../lib/demo-preview";

const project = "https://reviewstestprojectxx.supabase.co";
const fixture = `http://127.0.0.1:${process.env.PLAYWRIGHT_REVIEWS_SUPABASE_PORT ?? 54349}`;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const card = (page: Page, n: number) => page.getByTestId(`review-${id(n)}`);
const state = async (request: APIRequestContext) => (await request.get(`${fixture}/__reviews/state`)).json();
async function configure(request: APIRequestContext, settings: object) {
  expect((await request.post(`${fixture}/__reviews/configure`, { data: settings })).ok()).toBeTruthy();
}
async function queue(page: Page, label: string) {
  await page.getByRole("button", { name: /^Queue/ }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
  await expect(page.getByRole("button", { name: "Refresh queue" })).toBeEnabled();
}
async function signIn(page: Page) {
  // Both browser and server traffic use this synthetic project. No RMT or PRD
  // credentials/requests are redirected into the fixture.
  await page.route(`${project}/**`, async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${fixture}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  await page.routeWebSocket("wss://reviewstestprojectxx.supabase.co/**", (socket) => socket.close());
  await page.goto("/login");
  await page.getByLabel("Username").fill("member@example.com");
  await page.getByPlaceholder("Enter your password", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("[data-workspace-shell]")).toBeVisible();
}
test.beforeEach(async ({ request }) => {
  expect((await request.post(`${fixture}/__reviews/reset`, { data: {} })).ok()).toBeTruthy();
});

test("loads pending reviews on the server and compares a waiting edit with the approved version", async ({ page }) => {
  await signIn(page);
  await page.goto("/store-reviews");
  await expect(page).toHaveTitle(/Store Reviews/);
  await expect(card(page, 1).getByRole("img", { name: "1 out of 5 stars" })).toBeVisible();
  // A review written without a matching order is labelled in words, not only by colour.
  await expect(card(page, 1)).toContainText("No matching order");
  await expect(card(page, 2)).not.toContainText("No matching order");
  await expect(card(page, 2).getByRole("region", { name: "Waiting edit" })).toContainText("Updated after washing.");
  await expect(card(page, 2).getByRole("region", { name: "Published version" })).toContainText("Original approved text.");
  // Its own sidebar entry, not an admin tab, counting every waiting review.
  const nav = page.locator("#desktop-workspace-navigation").getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "Store Reviews 3 waiting reviews" })).toHaveAttribute("href", "/store-reviews");
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toHaveCount(0);
});

test("publishes the exact one-star revision and preserves all version digits", async ({ page, request }) => {
  await signIn(page); await page.goto("/store-reviews");
  await card(page, 1).getByRole("button", { name: "Publish review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Publish review" });
  await expect(dialog).toContainText("The size ran small.");
  await dialog.getByRole("button", { name: "Publish review", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Publish review: saved." })).toBeVisible();
  await expect(card(page, 1)).toHaveCount(0);
  await expect(page.locator("#desktop-workspace-navigation").getByRole("link", { name: "Store Reviews 2 waiting reviews" })).toBeVisible();
  const { calls } = await state(request);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ p_action: "approve", p_review_id: id(1), p_revision_id: id(101), p_expected_updated_at: "2026-11-18T12:00:00.123456Z" });
  await queue(page, "Published");
  await expect(card(page, 1).getByRole("img", { name: "1 out of 5 stars" })).toBeVisible();
});

test("requires a private rejection reason and keeps the approved version", async ({ page, request }) => {
  await signIn(page); await page.goto("/store-reviews");
  await card(page, 2).getByRole("button", { name: "Reject edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Reject edit" });
  await expect(dialog.getByLabel("Private reason")).toHaveAttribute("required", "");
  await expect(dialog.getByRole("button", { name: "Reject edit", exact: true })).toBeDisabled();
  await dialog.getByLabel("Private reason").fill("  Contains private information  ");
  await dialog.getByRole("button", { name: "Reject edit", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await queue(page, "Published");
  await expect(card(page, 2)).toContainText("Original approved text.");
  await expect(card(page, 2)).not.toContainText("Updated after washing.");
  await card(page, 2).getByRole("button", { name: /Recent history/ }).click();
  await expect(card(page, 2)).toContainText("Private reason: Contains private information");
  await expect(card(page, 2)).toContainText("Test Member");
  expect((await state(request)).calls[0].p_note).toBe("Contains private information");
});

test("hides with a reason and restores the approved review with its audit history", async ({ page }) => {
  await signIn(page); await page.goto("/store-reviews"); await queue(page, "Published");
  await card(page, 2).getByRole("button", { name: "Hide review for Fixture shirt 2" }).click();
  const hide = page.getByRole("dialog", { name: "Hide review" });
  await hide.getByLabel("Private reason").fill("Remove personal information first.");
  await hide.getByRole("button", { name: "Hide review", exact: true }).click();
  await expect(card(page, 2)).toHaveCount(0);
  await queue(page, "Hidden");
  await card(page, 2).getByRole("button", { name: "Restore review for Fixture shirt 2" }).click();
  const restore = page.getByRole("dialog", { name: "Restore review" });
  await expect(restore).toContainText("Any waiting edit still needs approval.");
  await restore.getByRole("button", { name: "Restore review", exact: true }).click();
  await expect(card(page, 2)).toHaveCount(0);
  await queue(page, "Published");
  await card(page, 2).getByRole("button", { name: /Recent history/ }).click();
  await expect(card(page, 2)).toContainText("Remove personal information first.");
});

test("approving a hidden edit keeps it hidden and withdrawn reviews offer no decisions", async ({ page }) => {
  await signIn(page); await page.goto("/store-reviews"); await queue(page, "Hidden");
  await card(page, 3).getByRole("button", { name: "Approve revision" }).click();
  const dialog = page.getByRole("dialog", { name: "Approve revision" });
  await expect(dialog).toContainText("The review stays hidden");
  await dialog.getByRole("button", { name: "Approve revision", exact: true }).click();
  await expect(card(page, 3)).toContainText("A hidden edit.");
  await expect(card(page, 3).getByText("Hidden", { exact: true })).toBeVisible();
  await queue(page, "All reviews");
  await expect(card(page, 4)).toContainText("Staff cannot restore this review.");
  await expect(card(page, 4).getByRole("button")).toHaveCount(1); // Read-only history disclosure.
});

test("refreshes conflicts without automatically repeating a decision", async ({ page, request }) => {
  await configure(request, { conflictOnce: true });
  await signIn(page); await page.goto("/store-reviews");
  await card(page, 1).getByRole("button", { name: "Publish review", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish review", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "read the latest text before deciding" })).toBeVisible();
  await expect(card(page, 1)).toContainText("The buyer replaced this text.");
  expect((await state(request)).calls).toHaveLength(1);
});

test("a saved decision with a failed reload blocks stale actions until a fresh read", async ({ page, request }) => {
  await configure(request, { failReadAfterSave: true });
  await signIn(page); await page.goto("/store-reviews");
  await card(page, 1).getByRole("button", { name: "Publish review", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish review", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Your decision was saved" })).toBeVisible();
  await expect(page.locator("article[data-testid^='review-']")).toHaveCount(0);
  await configure(request, { failRead: false, failReadAfterSave: false });
  await page.getByRole("button", { name: "Refresh queue" }).click();
  await expect(card(page, 2)).toBeVisible();
  await expect(card(page, 1)).toHaveCount(0);
  expect((await state(request)).calls).toHaveLength(1);
});

test("blocks duplicate decisions and dismissal while a save is pending", async ({ page, request }) => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  await signIn(page); await page.goto("/store-reviews");
  await page.route("**/api/admin/reviews", async (route) => {
    if (route.request().method() === "POST") await waiting;
    await route.continue();
  });
  await card(page, 1).getByRole("button", { name: "Publish review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Publish review" });
  try {
    await dialog.getByRole("button", { name: "Publish review", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await expect(dialog.getByLabel("Private reason")).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Close dialog" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog.getByRole("heading", { name: "Publish review", exact: true })).toBeVisible();
    await expect(card(page, 2).getByRole("button", { name: "Publish edit", includeHidden: true })).toBeDisabled();
  } finally { release(); }
  await expect(dialog).toHaveCount(0);
  expect((await state(request)).calls).toHaveLength(1);
});

test("a lost acknowledgement requires refresh without repeating the committed write", async ({ page, request }) => {
  await signIn(page); await page.goto("/store-reviews");
  await page.route("**/api/admin/reviews", async (route) => {
    if (route.request().method() === "POST") { await route.fetch(); await route.abort("failed"); }
    else await route.continue();
  });
  await card(page, 1).getByRole("button", { name: "Publish review", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish review", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "could not confirm this decision" })).toBeVisible();
  await expect(page.locator("article[data-testid^='review-']")).toHaveCount(0);
  expect((await state(request)).calls).toHaveLength(1);
  await page.getByRole("button", { name: "Refresh queue" }).click();
  await expect(card(page, 2)).toBeVisible(); await expect(card(page, 1)).toHaveCount(0);
  expect((await state(request)).calls).toHaveLength(1);
});

test("distinguishes failed initial reads from an empty queue and supports paging", async ({ page, request }) => {
  await configure(request, { failRead: true });
  await signIn(page); await page.goto("/store-reviews");
  await expect(page.getByRole("alert").filter({ hasText: "Reviews could not load" })).toBeVisible();
  await expect(page.getByText("No reviews waiting for a decision")).toHaveCount(0);
  expect((await request.post(`${fixture}/__reviews/reset`, { data: { many: true } })).ok()).toBeTruthy();
  await page.getByRole("button", { name: "Refresh queue" }).click();
  await expect(page.locator("article[data-testid^='review-']")).toHaveCount(20);
  await page.getByRole("button", { name: "Load more reviews" }).click();
  await expect(page.locator("article[data-testid^='review-']")).toHaveCount(23);
  await expect(page.getByRole("button", { name: "Load more reviews" })).toHaveCount(0);
});

test("redirects the old admin path to the sidebar page", async ({ page }) => {
  await signIn(page); await page.goto("/admin/reviews");
  await expect(page).toHaveURL(/\/store-reviews$/);
});

test("denies regular members and redirects demo preview away from moderation", async ({ page, request, baseURL }) => {
  expect((await request.post(`${fixture}/__reviews/reset`, { data: { role: "member" } })).ok()).toBeTruthy();
  await signIn(page); await page.goto("/store-reviews");
  await expect(page.getByRole("heading", { name: /Wrong turn/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Store Reviews/ })).toHaveCount(0);
  expect((await page.request.get("/api/admin/reviews/pending-count")).status()).toBe(403);
  expect((await page.request.get("/api/admin/reviews")).status()).toBe(403);
  expect((await request.post(`${fixture}/__reviews/reset`, { data: {} })).ok()).toBeTruthy();
  await page.context().addCookies([{ name: DEMO_PREVIEW_COOKIE, value: DEMO_PREVIEW_VALUE, url: baseURL! }]);
  await page.goto("/store-reviews");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Store Reviews", exact: true })).toHaveCount(0);
});

test("previews, creates, updates, and removes the official reply without changing the pending edit", async ({ page, request }) => {
  await signIn(page); await page.goto("/store-reviews");
  await expect(card(page, 1).getByRole("button", { name: /Write reply/ })).toHaveCount(0);
  await queue(page, "Published");
  await card(page, 2).getByRole("button", { name: "Write reply for Fixture shirt 2" }).click();
  let dialog = page.getByRole("dialog", { name: "Write reply", exact: true });
  await expect(dialog.getByLabel("Official reply")).toHaveAttribute("required", "");
  await expect(dialog.getByRole("button", { name: "Review reply", exact: true })).toBeDisabled();
  await dialog.getByLabel("Official reply").fill("x".repeat(2001));
  await expect(dialog.getByRole("alert")).toContainText("2,000 characters");
  await dialog.getByLabel("Official reply").fill("  Thanks, Ryan!\n\n\n<b>We hear you.</b>  ");
  await dialog.getByRole("button", { name: "Review reply", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Publish reply", exact: true });
  await expect(dialog.getByRole("region", { name: "Reply preview" })).toHaveText("Thanks, Ryan!\n\n<b>We hear you.</b>");
  await expect(dialog.locator("b")).toHaveCount(0);
  expect((await state(request)).calls).toHaveLength(0);
  await dialog.getByRole("button", { name: "Back to edit" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Review reply", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish reply", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card(page, 2).getByRole("region", { name: "Official reply" })).toContainText("Thanks, Ryan!");
  await expect(card(page, 2)).toContainText("Updated after washing.");
  let saved = await state(request);
  expect(saved.calls[0]).toMatchObject({ p_body: "Thanks, Ryan!\n\n<b>We hear you.</b>", p_expected_updated_at: "2026-11-18T12:00:00.123456Z" });
  const firstPublishedAt = saved.reviews.find((r: { id: string }) => r.id === id(2)).reply.publishedAt;
  await card(page, 2).getByRole("button", { name: "Edit reply for Fixture shirt 2" }).click();
  dialog = page.getByRole("dialog", { name: "Edit reply", exact: true });
  await expect(dialog.getByRole("button", { name: "Review reply", exact: true })).toBeDisabled();
  await dialog.getByLabel("Official reply").fill("Updated public reply.");
  await dialog.getByRole("button", { name: "Review reply", exact: true }).click();
  await page.getByRole("dialog", { name: "Update reply", exact: true }).getByRole("button", { name: "Update reply", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card(page, 2).getByRole("region", { name: "Official reply" })).toContainText("Updated public reply.");
  saved = await state(request);
  expect(saved.reviews.find((r: { id: string }) => r.id === id(2)).reply.publishedAt).toBe(firstPublishedAt);
  await card(page, 2).getByRole("button", { name: "Remove reply for Fixture shirt 2" }).click();
  await expect(page.getByRole("dialog").getByRole("region", { name: "Reply being removed" })).toHaveText("Updated public reply.");
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await state(request)).calls).toHaveLength(2);
  await card(page, 2).getByRole("button", { name: "Remove reply for Fixture shirt 2" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove reply", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card(page, 2)).toContainText("No official reply yet.");
  expect((await state(request)).calls[2].p_body).toBeNull();
  await card(page, 2).getByRole("button", { name: /Recent history/ }).click();
  await expect(card(page, 2)).toContainText("Reply removed");
});

test("a reply on a hidden review stays hidden and a stale editor cannot overwrite a newer reply", async ({ page, request }) => {
  await signIn(page); await page.goto("/store-reviews"); await queue(page, "Hidden");
  await card(page, 3).getByRole("button", { name: "Write reply for Fixture shirt 3" }).click();
  await expect(page.getByRole("dialog")).toContainText("The review stays hidden.");
  await page.getByRole("dialog").getByLabel("Official reply").fill("A hidden reply.");
  await page.getByRole("button", { name: "Review reply", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish reply", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card(page, 3)).toContainText("A hidden reply.");
  expect((await state(request)).reviews.find((r: { id: string }) => r.id === id(3)).state).toBe("hidden");
  await configure(request, { replyConflictOnce: true });
  await card(page, 3).getByRole("button", { name: "Edit reply for Fixture shirt 3" }).click();
  await page.getByRole("dialog").getByLabel("Official reply").fill("A stale reply.");
  await page.getByRole("button", { name: "Review reply", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Update reply", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "read the latest text" })).toBeVisible();
  await expect(card(page, 3)).toContainText("A newer staff reply.");
  await expect(card(page, 3)).not.toContainText("A stale reply.");
  expect((await state(request)).calls).toHaveLength(2);
});

test("a lost reply acknowledgement blocks further writes until refresh", async ({ page, request }) => {
  await signIn(page); await page.goto("/store-reviews"); await queue(page, "Published");
  await page.route("**/api/admin/reviews", async (route) => {
    if (route.request().method() === "PATCH") { await route.fetch(); await route.abort("failed"); }
    else await route.continue();
  });
  await card(page, 2).getByRole("button", { name: "Write reply for Fixture shirt 2" }).click();
  await page.getByRole("dialog").getByLabel("Official reply").fill("Saved once.");
  await page.getByRole("button", { name: "Review reply", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish reply", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "could not confirm this decision" })).toBeVisible();
  await expect(page.locator("article[data-testid^='review-']")).toHaveCount(0);
  expect((await state(request)).calls).toHaveLength(1);
  await page.getByRole("button", { name: "Refresh queue" }).click();
  await expect(card(page, 2)).toContainText("Saved once.");
  expect((await state(request)).calls).toHaveLength(1);
});

test("fits reply editing and public preview at mobile and desktop boundaries in both themes", async ({ page }, testInfo) => {
  await signIn(page);
  for (const theme of ["light", "dark"]) {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    for (const width of [390, 1024, 1280, 1536]) {
      await page.setViewportSize({ width, height: 1000 }); await page.goto("/store-reviews"); await queue(page, "Published");
      await card(page, 2).getByRole("button", { name: "Write reply for Fixture shirt 2" }).click();
      const field = page.getByRole("dialog").getByLabel("Official reply");
      await expect(field).toBeFocused(); await field.fill("Ryan".repeat(80));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`reply-editor-${theme}-${width}.png`) });
      await page.getByRole("button", { name: "Review reply", exact: true }).click();
      await expect(page.getByRole("dialog").getByRole("region", { name: "Reply preview" })).toHaveText("Ryan".repeat(80));
      if (width === 390 || width === 1280) await page.screenshot({ path: testInfo.outputPath(`reply-preview-${theme}-${width}.png`) });
      await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
    }
  }
});

test("fits mobile and desktop boundary widths in both themes", async ({ page }, testInfo) => {
  await signIn(page);
  for (const theme of ["light", "dark"]) {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    for (const width of [390, 1024, 1280, 1536]) {
      await page.setViewportSize({ width, height: 1000 }); await page.goto("/store-reviews");
      await expect(card(page, 2)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}.png`), fullPage: true });
      if (width === 390 || width === 1280) {
        await card(page, 1).getByRole("button", { name: "Reject review" }).click();
        const dialog = page.getByRole("dialog", { name: "Reject review" });
        await expect(dialog.getByLabel("Private reason")).toBeFocused();
        await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}-dialog.png`) });
        await dialog.getByRole("button", { name: "Cancel" }).click();
      }
    }
  }
});

test("wraps long names and review text without horizontal overflow", async ({ page, request }, testInfo) => {
  expect((await request.post(`${fixture}/__reviews/reset`, { data: { longText: true } })).ok()).toBeTruthy();
  await signIn(page);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 1000 }); await page.goto("/store-reviews");
    await expect(card(page, 2)).toContainText("review".repeat(150));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await card(page, 2).screenshot({ path: testInfo.outputPath(`long-text-${width}.png`) });
  }
});
