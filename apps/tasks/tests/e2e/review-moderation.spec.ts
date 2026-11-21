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
const successToast = (page: Page, message: string) => page.getByRole("status").filter({
  hasText: message,
  has: page.getByRole("button", { name: "Dismiss notification", exact: true }),
});
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
  await expect(card(page, 2)).toContainText("Verified purchase");
  const unmatchedInfo = card(page, 1).getByRole("button", { name: "What does no matching order mean?" });
  await unmatchedInfo.focus();
  await expect(page.getByRole("tooltip")).toContainText("This does not mean the review is fake.");
  await unmatchedInfo.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  const verifiedInfo = card(page, 2).getByRole("button", { name: "What does verified purchase mean?" }).first();
  await verifiedInfo.focus();
  await expect(page.getByRole("tooltip")).toContainText("reviewer's own order");
  await verifiedInfo.press("Escape");
  await expect(card(page, 2).getByRole("region", { name: "Waiting edit" })).toContainText("Updated after washing.");
  await expect(card(page, 2).getByRole("region", { name: "Published version" })).toContainText("Original approved text.");
  // Its own sidebar entry, not an admin tab, counting every waiting review.
  const nav = page.locator("#desktop-workspace-navigation").getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "Store Reviews 3 waiting reviews" })).toHaveAttribute("href", "/store-reviews");
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toHaveCount(0);
});

test("publishes the exact one-star revision and preserves all version digits", async ({ page, request }) => {
  await signIn(page); await page.goto("/store-reviews");
  // Publishing saves on click, with no confirmation or note.
  await card(page, 1).getByRole("button", { name: "Publish review", exact: true }).click();
  await expect(successToast(page, "Publish review: saved.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card(page, 1)).toHaveCount(0);
  await expect(page.locator("#desktop-workspace-navigation").getByRole("link", { name: "Store Reviews 2 waiting reviews" })).toBeVisible();
  const { calls } = await state(request);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ p_action: "approve", p_review_id: id(1), p_revision_id: id(101), p_expected_updated_at: "2026-11-18T12:00:00.123456Z", p_note: null });
  await queue(page, "Published");
  await expect(card(page, 1).getByRole("img", { name: "1 out of 5 stars" })).toBeVisible();
});

test("requires a buyer-facing rejection reason and keeps the approved version", async ({ page, request }) => {
  await signIn(page); await page.goto("/store-reviews");
  await card(page, 2).getByRole("button", { name: "Reject edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Reject edit" });
  await expect(dialog.getByLabel("Reason for the buyer")).toHaveAttribute("required", "");
  await expect(dialog).toContainText("The buyer sees this on My reviews");
  await expect(dialog.getByRole("button", { name: "Reject edit", exact: true })).toBeDisabled();
  await dialog.getByLabel("Reason for the buyer").fill("  Contains private information  ");
  await dialog.getByRole("button", { name: "Reject edit", exact: true }).click();
  await expect(successToast(page, "Reject edit: saved.")).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await queue(page, "Published");
  await expect(card(page, 2).getByRole("region", { name: "Published version" })).toContainText("Original approved text.");
  // Rejected text is kept beside the public version, never deleted.
  await expect(card(page, 2).getByRole("region", { name: "Rejected edit" })).toContainText("Updated after washing.");
  await expect(card(page, 2)).toContainText("Reason shown to the buyer: Contains private information");
  await card(page, 2).getByRole("button", { name: /Recent history/ }).click();
  await expect(card(page, 2)).toContainText("Test Member");
  expect((await state(request)).calls[0].p_note).toBe("Contains private information");
});

test("keeps a rejected review in its own queue and can publish it anyway", async ({ page, request }) => {
  await signIn(page); await page.goto("/store-reviews");
  await expect(card(page, 1).getByRole("button", { name: /Recent history/ })).toHaveCount(0);
  await card(page, 1).getByRole("button", { name: "Reject review", exact: true }).click();
  const reject = page.getByRole("dialog", { name: "Reject review" });
  await reject.getByLabel("Reason for the buyer").fill("Not about the shirt.");
  await reject.getByRole("button", { name: "Reject review", exact: true }).click();
  await expect(card(page, 1)).toHaveCount(0);
  await queue(page, "Rejected");
  await expect(card(page, 1).getByRole("region", { name: "Rejected version" })).toContainText("The size ran small.");
  await expect(card(page, 1)).toContainText("Reason shown to the buyer: Not about the shirt.");
  await expect(card(page, 1).getByText("Rejected", { exact: true }).first()).toBeVisible(); // The status chip.
  await expect(card(page, 1).getByRole("button", { name: /Recent history \(2\)/ })).toBeVisible();
  await card(page, 1).getByRole("button", { name: "Publish anyway" }).click();
  await expect(successToast(page, "Publish anyway: saved.")).toBeVisible();
  await expect(page.getByText("No rejected reviews")).toBeVisible();
  const { calls } = await state(request);
  expect(calls.at(-1)).toMatchObject({ p_action: "republish", p_review_id: id(1), p_revision_id: id(101), p_note: null });
  await queue(page, "Published");
  await expect(card(page, 1).getByRole("region", { name: "Published version" })).toContainText("The size ran small.");
});

test("narrows any queue to one product", async ({ page }) => {
  await signIn(page); await page.goto("/store-reviews");
  await expect(card(page, 1)).toBeVisible(); await expect(card(page, 2)).toBeVisible();
  await page.getByRole("button", { name: /^Product/ }).click();
  await page.getByRole("option", { name: "Fixture shirt 2", exact: true }).click();
  await expect(card(page, 1)).toHaveCount(0);
  await expect(card(page, 2)).toBeVisible();
  await queue(page, "All reviews");
  await expect(page.locator('[aria-label="Review queue"] article')).toHaveCount(1);
  await page.getByRole("button", { name: /^Product/ }).click();
  await page.getByRole("option", { name: "All products", exact: true }).click();
  await expect(card(page, 4)).toBeVisible();
});

test("hides with a reason and restores the approved review with its audit history", async ({ page }) => {
  await signIn(page); await page.goto("/store-reviews"); await queue(page, "Published");
  await card(page, 2).getByRole("button", { name: "Hide review for Fixture shirt 2" }).click();
  const hide = page.getByRole("dialog", { name: "Hide review" });
  await hide.getByLabel("Private reason").fill("Remove personal information first.");
  await hide.getByRole("button", { name: "Hide review", exact: true }).click();
  await expect(successToast(page, "Hide review: saved.")).toBeVisible();
  await expect(card(page, 2)).toHaveCount(0);
  await queue(page, "Hidden");
  await card(page, 2).getByRole("button", { name: "Restore review for Fixture shirt 2" }).click();
  const restore = page.getByRole("dialog", { name: "Restore review" });
  await expect(restore).toContainText("Any waiting edit still needs approval.");
  await restore.getByRole("button", { name: "Restore review", exact: true }).click();
  await expect(successToast(page, "Restore review: saved.")).toBeVisible();
  await expect(card(page, 2)).toHaveCount(0);
  await queue(page, "Published");
  await card(page, 2).getByRole("button", { name: /Recent history/ }).click();
  await expect(card(page, 2)).toContainText("Remove personal information first.");
});

test("approving a hidden edit keeps it hidden and withdrawn reviews offer no decisions", async ({ page }) => {
  await signIn(page); await page.goto("/store-reviews"); await queue(page, "Hidden");
  await expect(card(page, 3)).toContainText("Approving an edit keeps it hidden.");
  await card(page, 3).getByRole("button", { name: "Approve revision" }).click();
  await expect(successToast(page, "Approve revision: saved.")).toBeVisible();
  await expect(card(page, 3)).toContainText("A hidden edit.");
  await expect(card(page, 3).getByText("Hidden", { exact: true })).toBeVisible();
  await queue(page, "All reviews");
  await expect(card(page, 4)).toContainText("Staff cannot restore this review.");
  // No decisions, and a lone "Submitted" event adds no history disclosure.
  // Deleting stays available, since a withdrawn review can still be spam.
  await expect(card(page, 4).getByRole("button")).toHaveCount(1);
  await expect(card(page, 4).getByRole("button", { name: "Delete review for Fixture shirt 4" })).toBeVisible();
});

test("refreshes conflicts without automatically repeating a decision", async ({ page, request }) => {
  await configure(request, { conflictOnce: true });
  await signIn(page); await page.goto("/store-reviews");
  await card(page, 1).getByRole("button", { name: "Publish review", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "read the latest text before deciding" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dismiss notification", exact: true })).toHaveCount(0);
  await expect(card(page, 1)).toContainText("The buyer replaced this text.");
  expect((await state(request)).calls).toHaveLength(1);
});

test("a saved decision with a failed reload blocks stale actions until a fresh read", async ({ page, request }) => {
  await configure(request, { failReadAfterSave: true });
  await signIn(page); await page.goto("/store-reviews");
  await card(page, 1).getByRole("button", { name: "Publish review", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Your decision was saved" })).toBeVisible();
  await expect(successToast(page, "Publish review: saved.")).toBeVisible();
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
  const publish = card(page, 1).getByRole("button", { name: "Publish review", exact: true });
  try {
    await publish.click();
    await expect(publish).toBeDisabled();
    await expect(successToast(page, "Publish review: saved.")).toHaveCount(0);
    await expect(card(page, 2).getByRole("button", { name: "Publish edit", includeHidden: true })).toBeDisabled();
    await publish.click({ force: true });
  } finally { release(); }
  await expect(successToast(page, "Publish review: saved.")).toBeVisible();
  expect((await state(request)).calls).toHaveLength(1);
});

test("a lost acknowledgement requires refresh without repeating the committed write", async ({ page, request }) => {
  await signIn(page); await page.goto("/store-reviews");
  await page.route("**/api/admin/reviews", async (route) => {
    if (route.request().method() === "POST") { await route.fetch(); await route.abort("failed"); }
    else await route.continue();
  });
  await card(page, 1).getByRole("button", { name: "Publish review", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "could not confirm this decision" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dismiss notification", exact: true })).toHaveCount(0);
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
  await expect(successToast(page, "Write reply: saved.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card(page, 2).getByRole("region", { name: "Reply from Ryan Meetup" })).toContainText("Thanks, Ryan!");
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
  await expect(successToast(page, "Edit reply: saved.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card(page, 2).getByRole("region", { name: "Reply from Ryan Meetup" })).toContainText("Updated public reply.");
  saved = await state(request);
  expect(saved.reviews.find((r: { id: string }) => r.id === id(2)).reply.publishedAt).toBe(firstPublishedAt);
  await card(page, 2).getByRole("button", { name: "Remove reply for Fixture shirt 2" }).click();
  await expect(page.getByRole("dialog").getByRole("region", { name: "Reply being removed" })).toHaveText("Updated public reply.");
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await state(request)).calls).toHaveLength(2);
  await card(page, 2).getByRole("button", { name: "Remove reply for Fixture shirt 2" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove reply", exact: true }).click();
  await expect(successToast(page, "Remove reply: saved.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card(page, 2).getByRole("region", { name: "Official reply" })).not.toContainText("Updated public reply.");
  await expect(card(page, 2).getByRole("button", { name: "Write reply for Fixture shirt 2" })).toBeVisible();
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
  await expect(successToast(page, "Write reply: saved.")).toBeVisible();
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
  await expect(successToast(page, "Write reply: saved.")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "could not confirm this decision" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dismiss notification", exact: true })).toHaveCount(0);
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
      const first = await card(page, 1).boundingBox();
      const second = await card(page, 2).boundingBox();
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      if (width === 390) {
        expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
      } else if (width >= 1280) {
        // Use desktop space for another review while preserving oldest-first row order.
        expect(second!.y).toBe(first!.y);
        expect(second!.x).toBeGreaterThan(first!.x + first!.width);
      }
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}.png`), fullPage: true });
      if (width === 390 || width === 1280) {
        await card(page, 1).getByRole("button", { name: "Reject review" }).click();
        const dialog = page.getByRole("dialog", { name: "Reject review" });
        await expect(dialog.getByLabel("Reason for the buyer")).toBeFocused();
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

test("deletes spam only after a policy reason and a rating-neutral confirmation", async ({ page, request }) => {
  await signIn(page); await page.goto("/store-reviews");
  await card(page, 1).getByRole("button", { name: "Delete review for Fixture shirt 1" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete review" });
  // The FTC standard stays on screen beside the review being deleted.
  await expect(dialog.getByRole("region", { name: "FTC rules on removing reviews" })).toContainText("16 CFR 465.7");
  await expect(dialog.getByRole("region", { name: "Review being deleted" })).toContainText("The size ran small.");
  const confirm = dialog.getByRole("button", { name: "Delete review", exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("button", { name: /^Reason/ }).click();
  await page.getByRole("option", { name: "Spam or fake review", exact: true }).click();
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Private note").fill("Link to a follower shop");
  await dialog.getByRole("checkbox").check();
  await confirm.click();
  await expect(successToast(page, "Review deleted and logged.")).toBeVisible();
  await expect(card(page, 1)).toHaveCount(0);
  const { calls } = await state(request);
  expect(calls.at(-1)).toEqual({ p_actor: expect.any(String), p_shop_id: "123", p_review_id: id(1),
    p_expected_updated_at: "2026-11-18T12:00:00.123456Z", p_reason: "spam", p_note: "Link to a follower shop" });
});

test("a withdrawn review can still be deleted, and a stale view is refused", async ({ page, request }) => {
  await signIn(page); await page.goto("/store-reviews"); await queue(page, "All reviews");
  await configure(request, { conflictOnce: true });
  await card(page, 4).getByRole("button", { name: "Delete review for Fixture shirt 4" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete review" });
  await dialog.getByRole("button", { name: /^Reason/ }).click();
  await page.getByRole("option", { name: "Unrelated to the product", exact: true }).click();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Delete review", exact: true }).click();
  await expect(page.getByText("This review changed or was already deleted.")).toBeVisible();
  await card(page, 4).getByRole("button", { name: "Delete review for Fixture shirt 4" }).click();
  await dialog.getByRole("button", { name: /^Reason/ }).click();
  await page.getByRole("option", { name: "Unrelated to the product", exact: true }).click();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Delete review", exact: true }).click();
  await expect(successToast(page, "Review deleted and logged.")).toBeVisible();
  await expect(card(page, 4)).toHaveCount(0);
});

test("publishing a review publishes its photos except ones rejected first", async ({ page, request }) => {
  await request.post(`${fixture}/__reviews/reset`, { data: { photos: true } });
  await signIn(page); await page.goto("/store-reviews");
  // No separate photo approval: undecided photos ride along with the review.
  await expect(card(page, 1).getByRole("button", { name: "Approve photo", exact: true })).toHaveCount(0);
  await expect(card(page, 1).getByText("Publishes with review", { exact: true })).toHaveCount(2);
  const reject = card(page, 1).getByRole("button", { name: "Reject photo", exact: true });
  await expect(reject.nth(1)).toBeEnabled(); await reject.nth(1).click();
  const rejecting = page.getByRole("dialog", { name: "Reject photo", exact: true });
  await expect(rejecting.getByRole("img", { name: "Photo being moderated" })).toBeVisible();
  const confirm = rejecting.getByRole("button", { name: "Reject photo", exact: true });
  await expect(confirm).toBeDisabled();
  await rejecting.getByLabel("Reason for the buyer").fill("Private information in the background");
  await expect(confirm).toBeEnabled(); await confirm.click();
  await expect(successToast(page, "Reject photo: saved.")).toBeVisible();
  await expect(card(page, 1)).toContainText("Photo rejected");
  await expect(card(page, 1)).toContainText("Reason shown to the buyer: Private information in the background");
  // A rejection can still be undone before or after publishing.
  await expect(card(page, 1).getByRole("button", { name: "Approve photo", exact: true })).toHaveCount(1);
  await card(page, 1).getByRole("button", { name: "Publish review", exact: true }).click();
  await expect(successToast(page, "Publish review: saved.")).toBeVisible();
  await expect(card(page, 1)).toHaveCount(0);
  await queue(page, "Published");
  await expect(card(page, 1)).toContainText("Photo approved"); await expect(card(page, 1)).toContainText("Photo rejected");
  await expect(card(page, 1)).toContainText("Reason shown to the buyer: Private information in the background");
  const { calls } = await state(request);
  expect(calls.at(-2)).toMatchObject({ p_photo_id: id(1002), p_revision_id: id(101), p_action: "reject", p_note: "Private information in the background" });
  expect(calls.at(-1)).toMatchObject({ p_action: "approve", p_review_id: id(1), p_revision_id: id(101) });
});

test("photo decisions use exact versions and require fresh text after a conflict", async ({ page, request }) => {
  await request.post(`${fixture}/__reviews/reset`, { data: { photos: true } });
  await signIn(page); await page.goto("/store-reviews");
  await configure(request, { conflictOnce: true });
  const reject = card(page, 1).getByRole("button", { name: "Reject photo", exact: true });
  await expect(reject.first()).toBeEnabled(); await reject.first().click();
  const dialog = page.getByRole("dialog", { name: "Reject photo", exact: true });
  await dialog.getByLabel("Reason for the buyer").fill("Blurry");
  await dialog.getByRole("button", { name: "Reject photo", exact: true }).click();
  await expect(page.getByText("This review changed. The queue has been refreshed; read the latest text before deciding.", { exact: true })).toBeVisible();
  await expect(card(page, 1)).not.toContainText("Photo rejected");
});

test("photo previews and decision forms fit both themes at mobile and desktop boundaries", async ({ page, request }, testInfo) => {
  await request.post(`${fixture}/__reviews/reset`, { data: { photos: true } });
  await signIn(page);
  for (const theme of ["light", "dark"]) {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    for (const width of [390, 1024, 1280, 1536]) {
      await page.setViewportSize({ width, height: 1000 }); await page.goto("/store-reviews");
      const reject = card(page, 1).getByRole("button", { name: "Reject photo", exact: true }).first();
      await expect(reject).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await card(page, 1).screenshot({ path: testInfo.outputPath(`photos-${theme}-${width}.png`) });
      await reject.click();
      const dialog = page.getByRole("dialog", { name: "Reject photo", exact: true });
      await expect(dialog.getByRole("img", { name: "Photo being moderated" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`photo-decision-${theme}-${width}.png`) });
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    }
  }
});

test("failed photo previews need retry and a lost decision acknowledgement needs refresh", async ({ page, request }) => {
  await request.post(`${fixture}/__reviews/reset`, { data: { photos: true } });
  await signIn(page);
  let unavailable = true;
  await page.route("**/api/admin/reviews/photos?**", async (route) => {
    if (unavailable) await route.fulfill({ status: 503, body: "" });
    else await route.continue();
  });
  await page.goto("/store-reviews");
  const review = card(page, 1);
  await expect(review.getByText("Photo could not load.")).toHaveCount(2);
  await expect(review.getByRole("button", { name: "Reject photo", exact: true }).first()).toBeDisabled();
  unavailable = false;
  await review.getByRole("button", { name: "Retry photo", exact: true }).first().click();
  const reject = review.getByRole("button", { name: "Reject photo", exact: true }).first();
  await expect(reject).toBeEnabled(); await reject.click();
  const dialog = page.getByRole("dialog", { name: "Reject photo", exact: true });
  await dialog.getByLabel("Reason for the buyer").fill("Blurry");
  await page.route("**/api/admin/reviews/photos", async (route) => {
    if (route.request().method() === "POST") { await route.fetch(); await route.abort("failed"); }
    else await route.continue();
  });
  await dialog.getByRole("button", { name: "Reject photo", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "could not confirm this decision" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dismiss notification", exact: true })).toHaveCount(0);
  expect((await state(request)).calls).toHaveLength(1);
  await expect(review).toHaveCount(0);
  await page.getByRole("button", { name: "Refresh queue", exact: true }).click();
  await expect(review).toContainText("Photo rejected");
  expect((await state(request)).calls).toHaveLength(1);
});
