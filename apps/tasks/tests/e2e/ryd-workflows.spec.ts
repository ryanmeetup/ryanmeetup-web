import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(
    (theme: string) => localStorage.setItem("theme", theme),
    testInfo.project.name === "chromium-mobile" ? "light" : "dark",
  );
});

const fixtureOrigin = `http://127.0.0.1:${process.env.PLAYWRIGHT_RYD_SUPABASE_PORT ?? 54339}`;
const csv =
  "OrderId,BillFirstName,BillLastName,BillEmail,Verified?,OrderTotal\r\n801,Ryan,Fixture,ryan.fixture@example.test,,36\r\n";
const snapshotId = "00000000-0000-4000-8000-000000000801";
const state = async (request: APIRequestContext) =>
  (await request.get(`${fixtureOrigin}/__ryd/state`)).json();
async function reset(
  request: APIRequestContext,
  options: { enabled?: boolean; role?: string } = {},
) {
  expect(
    (
      await request.post(`${fixtureOrigin}/__ryd/reset`, { data: options })
    ).ok(),
  ).toBeTruthy();
}
async function expectMissingPage(page: Page, path: string) {
  await page.goto(path);
  // Next may stream the not-found boundary after a 200 response has begun.
  await expect(
    page.getByRole("heading", { name: "404", exact: true }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
}
async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill("member@example.com");
  await page
    .getByPlaceholder("Enter your password", { exact: true })
    .fill("synthetic-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("[data-workspace-shell]")).toBeVisible();
}

test("runs import, explicit linking, review, immutable export, confirmation, and production", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  await reset(request);
  await signIn(page);
  await page.goto("/ryd");
  await expect(
    page.getByRole("heading", { name: "RY-D Verification", exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Upload orders", exact: true })
    .click();
  const upload = page.getByRole("dialog", {
    name: "Upload orders",
    exact: true,
  });
  await upload.getByLabel("Order CSV", { exact: false }).setInputFiles({
    name: "synthetic-ryd.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await upload.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(upload).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review Ryan Fixture", exact: true }),
  ).toBeVisible();
  expect(
    (await state(request)).calls.map((call: { name: string }) => call.name),
  ).toEqual(["ryd_import_orders"]);
  await page
    .getByRole("button", { name: "Review Ryan Fixture", exact: true })
    .click();
  const review = page.getByRole("dialog");
  await expect(
    review.getByRole("link", {
      name: "@ryanfixture",
      exact: false,
    }),
  ).toBeVisible();
  await review.getByRole("button", { name: "Link", exact: true }).click();
  await expect(review.getByText("Linked", { exact: true })).toBeVisible();
  await review
    .getByLabel("Note", { exact: true })
    .fill("Checked the synthetic form response.");
  await review.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(review).toHaveCount(0);
  await page
    .getByRole("button", { name: "Send to fulfillment", exact: true })
    .click();
  const send = page.getByRole("dialog", {
    name: "Send to fulfillment",
    exact: true,
  });
  const downloadLink = send.getByRole("link", {
    name: "Download CSV",
    exact: true,
  });
  await expect(downloadLink).toHaveAttribute(
    "href",
    `/api/ryd/export?batch=${snapshotId}`,
  );
  // Request the same URL as the download without opening an external mail app.
  const exported = await page.request.get(
    (await downloadLink.getAttribute("href"))!,
  );
  expect(exported.headers()["cache-control"]).toBe("no-store");
  expect(await exported.text()).toContain(
    "801,Ryan,Fixture,ryan.fixture@example.test,✅,36",
  );
  const mail = await send
    .getByRole("link", { name: "Open draft", exact: true })
    .getAttribute("href");
  expect(decodeURIComponent(mail!)).toContain("801 · Ryan Fixture");
  const prepared = await state(request);
  expect(prepared.snapshot.state).toBe("prepared");
  expect(prepared.batches).toEqual([]);
  await send.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Send to fulfillment", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Download CSV" }),
  ).toHaveAttribute("href", `/api/ryd/export?batch=${snapshotId}`);
  await page.getByRole("button", { name: "Mark as sent", exact: true }).click();
  const completed = page.getByRole("dialog", {
    name: "Batch marked sent",
    exact: true,
  });
  await expect(completed.getByRole("status")).toContainText(
    "1 of 1 orders cleared to start",
  );
  await expect(completed.getByRole("status")).toBeFocused();
  await completed
    .getByRole("button", { name: "Response details (1)", exact: true })
    .click();
  await expect(
    completed.getByText("Ryan Fixture · Updated", { exact: true }),
  ).toBeVisible();
  await completed
    .getByText("Ryan Fixture · Updated", { exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    completed.getByText("Ryan Fixture · Updated", { exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath("sheet-result.png"),
    fullPage: true,
  });
  await completed.getByRole("button", { name: "Close", exact: true }).click();
  const confirmed = await state(request);
  expect(confirmed.batches).toHaveLength(1);
  expect(confirmed.sheetWrites).toHaveLength(1);
  expect(confirmed.sheetWrites[0].data[0].dataFilter.gridRange).toMatchObject({
    sheetId: 77,
    startRowIndex: 1,
    startColumnIndex: 3,
  });
  const replay = await page.request.post("/api/ryd/batches", {
    data: { action: "confirm", snapshotId },
  });
  expect(await replay.json()).toMatchObject({
    changed: false,
    sheet: { issue: "already-confirmed" },
  });
  expect((await state(request)).sheetWrites).toHaveLength(1);
  await page.goto("/ryd?status=verified");
  await page
    .getByRole("checkbox", { name: "Select Ryan Fixture", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Sent for production", exact: true })
    .click();
  const production = page.getByRole("dialog", {
    name: "Send for production",
    exact: true,
  });
  await production
    .getByRole("button", { name: "Send for production", exact: true })
    .click();
  await expect(
    production
      .getByRole("status")
      .filter({ hasText: "orders confirmed saved" }),
  ).toContainText("1 of 1 orders confirmed saved");
  await production.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Select Ryan Fixture", exact: true })
    .check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const done = page.getByRole("dialog", { name: "Mark done", exact: true });
  await done.getByRole("button", { name: "Mark done", exact: true }).click();
  await expect(
    done.getByRole("status").filter({ hasText: "orders confirmed saved" }),
  ).toContainText("1 of 1 orders confirmed saved");
  const finished = await state(request);
  expect(finished.orders[0]).toMatchObject({
    status: "verified",
    note: "Checked the synthetic form response.",
    cleared_batch_id: snapshotId,
    production_sent_at: expect.any(String),
    done_at: expect.any(String),
  });
  expect(finished.calls.map((call: { name: string }) => call.name)).toEqual([
    "ryd_import_orders",
    "ryd_link_submissions",
    "ryd_review_order",
    "ryd_prepare_fulfillment",
    "ryd_prepare_fulfillment",
    "ryd_finish_fulfillment",
    "ryd_finish_fulfillment",
    "ryd_move_production",
    "ryd_move_production",
  ]);
});

test("disabled instances hide the page and RY-D APIs", async ({
  page,
  request,
}) => {
  await reset(request, { enabled: false });
  await signIn(page);
  await expectMissingPage(page, "/ryd");
  expect((await page.request.get("/api/ryd")).status()).toBe(404);
  expect(
    (
      await page.request.patch("/api/ryd/settings", {
        data: { fulfillmentEmail: "other@example.test" },
      })
    ).status(),
  ).toBe(404);
  expect((await state(request)).calls).toEqual([]);
  expect((await state(request)).tableRequests).toEqual([]);
});

test("anonymous visitors cannot read, export, confirm, or change settings", async ({
  page,
  request,
}) => {
  await reset(request);
  await page.goto("/ryd");
  await expect(page).toHaveURL(/\/login$/);
  for (const path of ["/api/ryd", `/api/ryd/export?batch=${snapshotId}`])
    expect((await page.request.get(path)).status()).toBe(401);
  expect(
    (
      await page.request.post("/api/ryd/batches", {
        data: { action: "confirm", snapshotId },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await page.request.patch("/api/ryd/settings", {
        data: { fulfillmentEmail: "other@example.test" },
      })
    ).status(),
  ).toBe(401);
  expect((await state(request)).calls).toEqual([]);
  expect((await state(request)).tableRequests).toEqual([]);
});

test("denied members cannot reach RY-D data or settings", async ({
  page,
  request,
}) => {
  await reset(request, { role: "denied" });
  await signIn(page);
  await expectMissingPage(page, "/ryd");
  expect((await page.request.get("/api/ryd")).status()).toBe(403);
  expect(
    (
      await page.request.patch("/api/ryd/settings", {
        data: { fulfillmentEmail: "other@example.test" },
      })
    ).status(),
  ).toBe(403);
  expect((await state(request)).calls).toEqual([]);
  expect((await state(request)).tableRequests).toEqual([]);
});

for (const role of ["operator", "owner"])
  test(`${role} can save RY-D settings through the page authority`, async ({
    page,
    request,
  }) => {
    await reset(request, { role });
    await signIn(page);
    await page.goto("/ryd");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = page.getByRole("dialog", {
      name: "RY-D settings",
      exact: true,
    });
    await settings
      .getByLabel("Fulfillment email", { exact: false })
      .fill(`${role}@example.test`);
    await settings
      .getByRole("button", { name: "Save settings", exact: true })
      .click();
    await expect(settings).toHaveCount(0);
    expect((await page.request.get("/api/ryd")).ok()).toBeTruthy();
    expect(
      (await (await page.request.get("/api/ryd")).json()).settings
        .fulfillmentEmail,
    ).toBe(`${role}@example.test`);
    if (role === "operator") {
      await expectMissingPage(page, "/admin/settings");
    }
  });
