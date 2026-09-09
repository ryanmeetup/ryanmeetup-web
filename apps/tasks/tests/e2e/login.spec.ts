import { expect, test } from "@playwright/test";

test("responses include restrictive browser security headers", async ({ request }) => {
  const response = await request.get("/login");
  const headers = response.headers();

  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("'nonce-");
  expect(headers["content-security-policy"]).toContain("connect-src 'self'");
  expect(headers["content-security-policy"]).toMatch(/wss?:\/\/[^ ;]+/);
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
});

test("login exposes accessible credentials and validates missing input", async ({ page }) => {
  await page.goto("/login");
  // The wordmark is instance-configurable and can be overridden at runtime from
  // /admin/settings, so assert that it rendered rather than what it says.
  // Pinning the literal would fail on any instance that has named itself, and
  // on an unconfigured build it would only pin the neutral fallback.
  const wordmark = page.getByRole("heading", { level: 1 });
  await expect(wordmark).toBeVisible();
  await expect(wordmark).not.toBeEmpty();
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel(/^Password/)).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Error: username and password are required")).toBeVisible();
});

test("password visibility is keyboard-operable", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(/^Password/)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Show password" })).toBeFocused();
  await page.getByRole("button", { name: "Show password" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel(/^Password/)).toHaveAttribute("type", "text");
});

/**
 * Signing in used to hand the browser back to the client router, which had
 * already cached `/` as the redirect it answers a signed-out visitor with: the
 * router prefetches the footer's home link while the form is still on screen.
 * Replaying that after sign-in bounced `/` and `/login` off each other for as
 * long as the tab stayed open, painting nothing but the footer, and only a
 * hard refresh cleared it. The sign-in leaves that cache behind instead.
 */
test("signing in lands on the workspace instead of bouncing off /login", async ({ page }) => {
  const visited: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) visited.push(new URL(frame.url()).pathname);
  });

  await page.goto("/login");
  // Prefetching the home link is what poisons the cache, so provoke it rather
  // than waiting for the router to notice the footer on its own.
  await page.locator('footer a[href="/"]').first().hover();
  visited.length = 0;

  await page.getByLabel("Username").fill("member@example.com");
  await page.getByLabel(/^Password/).fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.locator("[data-workspace-shell]")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  expect(visited.filter((path) => path === "/login")).toHaveLength(0);
});
