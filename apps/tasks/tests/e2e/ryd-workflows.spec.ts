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
  options: { enabled?: boolean; role?: string; ambiguousForm?: boolean; legacyBatch?: boolean } = {},
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

test("sends only newly verified orders and rebuilds an older unsent batch", async ({ page, request }, testInfo) => {
  await reset(request, { legacyBatch: true });
  await signIn(page);
  const imported = await page.request.post("/api/ryd/imports", {
    multipart: {
      operationId: "00000000-0000-4000-8000-000000000811",
      file: {
        name: "next-batch.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          "OrderId,BillFirstName,BillLastName,BillEmail,Verified?\r\n" +
          "801,Ryan,New,new@example.test,✅\r\n" +
          "802,Ryan,Production,production@example.test,✅\r\n" +
          "803,Ryan,Done,done@example.test,✅\r\n" +
          "804,Ryan,Pending,pending@example.test,\r\n",
        ),
      },
    },
  });
  expect(imported.ok()).toBeTruthy();
  const moved = await page.request.post("/api/ryd/production", {
    data: {
      operationId: "00000000-0000-4000-8000-000000000812",
      moves: [
        { orderId: "802", from: "not-started", to: "in-production" },
        { orderId: "803", from: "not-started", to: "done" },
      ],
    },
  });
  expect(moved.ok()).toBeTruthy();
  await page.goto("/ryd?status=verified&production=not-started");
  await page.getByRole("button", { name: "Send to fulfillment", exact: true }).click();
  const send = page.getByRole("dialog", { name: "Send to fulfillment", exact: true });
  await expect(send.getByText("This saved batch includes", { exact: false })).toBeVisible();
  await expect(send.getByRole("button", { name: "Mark as sent", exact: true })).toBeDisabled();
  await expect(send.getByRole("link", { name: "Download CSV", exact: true })).toHaveCount(0);
  expect((await page.request.get(`/api/ryd/export?batch=${snapshotId}`)).status()).toBe(409);
  const widths = testInfo.project.name === "chromium-mobile" ? [390] : [1024, 1280, 1536];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`old-batch-${width}.png`) });
  }
  await send.getByRole("button", { name: "Cancel this batch", exact: true }).click();
  await page.getByRole("dialog", { name: "Cancel this fulfillment batch?", exact: true })
    .getByRole("button", { name: "Cancel batch", exact: true }).click();
  await expect(send).toHaveCount(0);
  await page.getByRole("button", { name: "Send to fulfillment", exact: true }).click();
  const download = send.getByRole("link", { name: "Download CSV", exact: true });
  await expect(download).toBeVisible();
  const file = await page.request.get((await download.getAttribute("href"))!);
  expect((await file.text()).trim().split(/\r?\n/)).toEqual([
    "OrderId,BillFirstName,BillLastName,BillEmail,Verified?",
    "801,Ryan,New,new@example.test,✅",
  ]);
  const draft = decodeURIComponent((await send.getByRole("link", { name: "Open draft", exact: true }).getAttribute("href"))!);
  expect(draft).toContain("801 · Ryan New");
  for (const name of ["Ryan Production", "Ryan Done", "Ryan Pending"]) expect(draft).not.toContain(name);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`new-batch-${width}.png`) });
  }
  await send.getByRole("button", { name: "Mark as sent", exact: true }).click();
  await page.getByRole("dialog", { name: "Batch marked sent", exact: true })
    .getByRole("button", { name: "Close", exact: true }).click();
  const verified = await page.request.patch("/api/ryd/orders/804", { data: { status: "verified" } });
  expect(verified.ok()).toBeTruthy();
  const next = await page.request.post("/api/ryd/batches", { data: { action: "prepare" } });
  expect(await next.json()).toMatchObject({ orderCount: 1, verifiedCount: 1 });
  expect((await state(request)).snapshot.verified_ids).toEqual(["804"]);
});

test("sorts the production column by stage and sent date", async ({ page, request }, testInfo) => {
  await reset(request);
  await signIn(page);
  const imported = await page.request.post("/api/ryd/imports", {
    multipart: {
      operationId: "00000000-0000-4000-8000-000000000821",
      file: {
        name: "production-sort.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          "OrderId,BillFirstName,BillLastName,BillEmail,Verified?\r\n" +
          "801,Ryan,Waiting,waiting@example.test,✅\r\n" +
          "802,Ryan,Sent,sent@example.test,✅\r\n" +
          "803,Ryan,Done,done@example.test,✅\r\n",
        ),
      },
    },
  });
  expect(imported.ok()).toBeTruthy();
  expect((await page.request.post("/api/ryd/production", {
    data: {
      operationId: "00000000-0000-4000-8000-000000000822",
      moves: [
        { orderId: "802", from: "not-started", to: "in-production" },
        { orderId: "803", from: "not-started", to: "done" },
      ],
    },
  })).ok()).toBeTruthy();
  await page.goto("/ryd?status=verified");
  const sort = page.getByRole("button", { name: "Sort by production", exact: true });
  const header = page.getByRole("columnheader").filter({ has: sort });
  const rows = page.locator("table tbody tr");
  await sort.scrollIntoViewIfNeeded();
  await sort.press("Enter");
  await page.getByRole("menuitem", { name: "Not sent first", exact: true }).press("Enter");
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await expect(rows).toHaveText([/Ryan Waiting/, /Ryan Sent/, /Ryan Done/]);
  await expect(page).toHaveURL(/sort=production(?:&|$)/);
  await sort.click();
  await page.getByRole("menuitem", { name: "Done first", exact: true }).click();
  await expect(header).toHaveAttribute("aria-sort", "descending");
  await expect(rows).toHaveText([/Ryan Done/, /Ryan Sent/, /Ryan Waiting/]);
  await expect(page).toHaveURL(/sort=production-desc(?:&|$)/);
  await page.reload();
  await expect(header).toHaveAttribute("aria-sort", "descending");
  await expect(rows).toHaveText([/Ryan Done/, /Ryan Sent/, /Ryan Waiting/]);
  await sort.scrollIntoViewIfNeeded();
  await sort.click();
  await page.getByRole("menuitem", { name: "Newest sent first", exact: true }).click();
  await expect(page).toHaveURL(/sort=production-sent-desc(?:&|$)/);
  await expect(header).toHaveAttribute("aria-sort", "descending");
  await expect(rows).toHaveText([/Ryan Done/, /Ryan Sent/, /Ryan Waiting/]);
  await sort.click();
  await page.getByRole("menuitem", { name: "Oldest sent first", exact: true }).click();
  await expect(page).toHaveURL(/sort=production-sent(?:&|$)/);
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  const widths = testInfo.project.name === "chromium-mobile" ? [390] : [1024, 1280, 1536];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await sort.scrollIntoViewIfNeeded();
    await sort.click();
    await expect(page.getByRole("menu")).toHaveCSS("opacity", "1");
    await expect(page.getByRole("menu")).toBeInViewport();
    await expect(page.getByRole("menuitem", { name: "Newest sent first", exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`production-sort-${width}.png`) });
    await page.keyboard.press("Escape");
  }
  await sort.click();
  await page.getByRole("menuitem", { name: "Clear sort", exact: true }).click();
  await expect(header).toHaveAttribute("aria-sort", "none");
  await expect(page).not.toHaveURL(/[?&]sort=/);
  await expect(rows).toHaveText([/Ryan Waiting/, /Ryan Sent/, /Ryan Done/]);
});

test("shows ambiguous identity mapping and distinguishes buyer and review form links", async ({
  page,
  request,
}, testInfo) => {
  await reset(request, { ambiguousForm: true });
  await signIn(page);
  await page.goto("/ryd");
  const notice = page.getByRole("status").filter({ hasText: "possible legal-name questions" });
  await expect(notice).toContainText("2 possible email questions");
  const queue = await (await page.request.get("/api/ryd")).json();
  expect(queue.sheet.status).toBe("ok");
  expect(queue.sheet.warnings).toHaveLength(2);
  expect(queue.submissions[0]).toMatchObject({ legalName: "", email: "" });
  expect(queue.submissions[0].otherAnswers).toEqual(expect.arrayContaining([
    { question: "Legal name", answer: "Ryan Fixture" },
    { question: "Full name", answer: "Ryan Other" },
    { question: "Alternative email", answer: "other@example.test" },
  ]));
  await notice.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("mapping-warning.png"), fullPage: true });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "RY-D settings", exact: true });
  const buyer = settings.getByRole("link", { name: "buyer verification link", exact: true });
  const editor = settings.getByRole("link", { name: "Open review form editor", exact: true });
  await expect(buyer).toHaveAttribute("href", "https://ryanmeetup.com/cards/verify");
  await expect(editor).toHaveAttribute("href", `https://docs.google.com/forms/d/${"f".repeat(30)}/edit`);
  await expect(settings.getByText("This setting changes only", { exact: false })).toBeVisible();
  const form = settings.getByLabel("RY-dentification form", { exact: false });
  await form.fill("g".repeat(30));
  await expect(editor).toHaveAttribute("href", `https://docs.google.com/forms/d/${"g".repeat(30)}/edit`);
  const widths = testInfo.project.name === "chromium-mobile" ? [390] : [1024, 1280, 1536];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await editor.scrollIntoViewIfNeeded();
    await expect(buyer).toBeInViewport();
    await expect(editor).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`settings-links-${width}.png`) });
  }
  await buyer.focus();
  await page.keyboard.press("Tab");
  await expect(editor).toBeFocused();
  await form.fill("not a valid form link");
  await expect(editor).toHaveCount(0);
  await settings.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await state(request)).calls).toEqual([]);
});

test("decides selected orders together after confirming missing evidence", async ({ page, request }, testInfo) => {
  await reset(request);
  await signIn(page);
  await page.goto("/ryd");
  await page.getByRole("button", { name: "Upload orders", exact: true }).click();
  const upload = page.getByRole("dialog", { name: "Upload orders", exact: true });
  await upload.getByLabel("Order CSV", { exact: false }).setInputFiles({
    name: "synthetic-bulk.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`${csv}802,Ryan,Second,second@example.test,,36\r\n`),
  });
  await upload.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(upload).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Select all 2", exact: true }).check();
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Verify 2 orders?", exact: true });
  await expect(confirm).toContainText("1 has nothing on the form.");
  await page.screenshot({ path: testInfo.outputPath("bulk-review.png"), fullPage: true });
  await confirm.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(confirm).toHaveCount(0);
  const saved = await state(request);
  expect(saved.orders.map((order: { status: string }) => order.status)).toEqual(["verified", "verified"]);
  expect(saved.calls.filter((call: { name: string }) => call.name === "ryd_review_order")).toHaveLength(2);
});

test("saves the weekly upload reminder and displays its workspace-local time", async ({ page, request }, testInfo) => {
  await reset(request);
  await signIn(page);
  await page.goto("/ryd");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "RY-D settings", exact: true });
  await settings.getByRole("checkbox", { name: "Weekly upload reminder", exact: false }).check();
  await settings.getByRole("button", { name: "Day", exact: false }).click();
  await page.getByRole("option", { name: "Wednesday", exact: true }).click();
  await settings.getByRole("button", { name: "Time", exact: false }).click();
  await page.getByRole("option", { name: "9 AM", exact: true }).click();
  const widths = testInfo.project.name === "chromium-mobile" ? [390] : [1024, 1280, 1536];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await settings.getByRole("button", { name: "Time", exact: false }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`reminder-settings-${width}.png`) });
  }
  await settings.getByRole("button", { name: "Save settings", exact: true }).click();
  await expect(settings).toHaveCount(0);
  const queue = await (await page.request.get("/api/ryd")).json();
  expect(queue.settings.uploadReminder).toEqual({ enabled: true, weekday: 3, hour: 9 });
  const banner = page.getByRole("status").filter({ hasText: "It's upload day." });
  // Chromium and Node's ICU versions differ in punctuation. Check the actual
  // weekday/hour/day period independently, retaining the workspace-zone check.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: queue.timeZone, weekday: "long", hour: "numeric",
  }).formatToParts(new Date(queue.uploadDueSince));
  for (const part of parts.filter((part) => part.type !== "literal"))
    await expect(banner).toContainText(part.value);
  await banner.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("upload-reminder-banner.png") });
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
