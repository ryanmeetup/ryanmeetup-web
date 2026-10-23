import { readFile } from "node:fs/promises";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type Locator,
} from "@playwright/test";

async function downloadedCsv(page: Page, link: Locator) {
  const pending = page.waitForEvent("download");
  await link.click();
  const download = await pending;
  return readFile((await download.path())!, "utf8");
}

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

test("runs review, on-demand files, and independent manual fulfillment stages", async ({
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
  await page.goto("/ryd?status=verified");
  await expect(page.getByRole("button", { name: "Ready to send 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("checkbox", { name: "Select Ryan Fixture", exact: true }).check();
  await page
    .getByRole("button", { name: "Generate email & CSV (1)", exact: true })
    .click();
  const send = page.getByRole("dialog", {
    name: "Fulfillment email & CSV",
    exact: true,
  });
  const downloadLink = send.getByRole("link", {
    name: "Download CSV",
    exact: true,
  });
  await expect(downloadLink).toHaveAttribute("href", /^blob:/);
  expect(await downloadedCsv(page, downloadLink)).toContain("801,Ryan,Fixture,ryan.fixture@example.test,✅,36");
  const mail = await send.getByRole("link", { name: "Open email", exact: true }).getAttribute("href");
  expect(decodeURIComponent(mail!)).toContain("801 · Ryan Fixture");
  expect((await state(request)).snapshot).toBeNull();
  expect((await state(request)).orders[0].cleared_batch_id).toBeNull();
  await expect(send.getByRole("button", { name: "Confirm email sent", exact: true })).toHaveCount(0);
  await send.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Resume fulfillment batch", exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Select Ryan Fixture", exact: true }).check();
  await page.getByRole("button", { name: "Generate email & CSV (1)", exact: true }).click();
  await expect(downloadLink).toHaveAttribute("href", /^blob:/);
  await send.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ready to send 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Mark sent to fulfillment", exact: true }).click();
  const handoff = page.getByRole("dialog", { name: "Mark sent to fulfillment", exact: true });
  await handoff.getByRole("button", { name: "Mark sent to fulfillment", exact: true }).click();
  await expect(handoff.getByRole("status").filter({ hasText: "orders confirmed saved" })).toContainText("1 of 1 orders confirmed saved");
  await handoff.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sent to fulfillment 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect((await state(request)).orders[0].production_sent_at).toBeNull();
  await page.screenshot({ path: testInfo.outputPath("manual-handoff.png") });
  expect((await state(request)).snapshot).toBeNull();
  await page.goto("/ryd?status=verified&production=sent-to-fulfillment");
  await page
    .getByRole("checkbox", { name: "Select Ryan Fixture", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Confirm production started", exact: true })
    .click();
  const production = page.getByRole("dialog", {
    name: "Confirm production started",
    exact: true,
  });
  await production
    .getByRole("button", { name: "Confirm production started", exact: true })
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
    cleared_batch_id: expect.any(String),
    production_sent_at: expect.any(String),
    done_at: expect.any(String),
  });
  expect(finished.calls.map((call: { name: string }) => call.name)).toEqual([
    "ryd_import_orders", "ryd_link_submissions", "ryd_review_order",
    "ryd_generate_fulfillment", "ryd_generate_fulfillment",
    "ryd_move_production", "ryd_move_production", "ryd_move_production",
  ]);

});

test("ignores a previously saved email and generates fresh selected files without changing stages", async ({ page, request }, testInfo) => {
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
          "804,Ryan,Pending,pending@example.test,\r\n" +
          "805,Ryan,Unselected,unselected@example.test,✅\r\n",
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
  await page.getByRole("checkbox", { name: "Select Ryan New", exact: true }).check();
  await page.getByRole("button", { name: "Generate email & CSV (1)", exact: true }).click();
  const send = page.getByRole("dialog", { name: "Fulfillment email & CSV", exact: true });
  await expect(send.getByRole("link", { name: "Download CSV", exact: true })).toBeVisible();
  await expect(send.getByText("A different draft", { exact: false })).toHaveCount(0);
  await expect(send.getByRole("button", { name: /Replace|Cancel this batch|Confirm email sent/ })).toHaveCount(0);
  const oldDraft = (await state(request)).snapshot;
  const widths = testInfo.project.name === "chromium-mobile" ? [390] : [1024, 1280, 1536];
  const download = send.getByRole("link", { name: "Download CSV", exact: true });
  await expect(download).toBeVisible();
  const file = await downloadedCsv(page, download);
  expect(file.trim().split(/\r?\n/)).toEqual([
    "OrderId,BillFirstName,BillLastName,BillEmail,Verified?",
    "801,Ryan,New,new@example.test,✅",
  ]);
  const draft = decodeURIComponent((await send.getByRole("link", { name: "Open email", exact: true }).getAttribute("href"))!);
  expect(draft).toContain("801 · Ryan New");
  for (const name of ["Ryan Production", "Ryan Done", "Ryan Pending", "Ryan Unselected"]) expect(draft).not.toContain(name);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`new-batch-${width}.png`) });
  }
  await send.getByRole("button", { name: "Close", exact: true }).click();
  expect((await state(request)).snapshot).toEqual(oldDraft);
  expect((await state(request)).orders.find((order: { order_id: string }) => order.order_id === "801").cleared_batch_id).toBeNull();
  const verified = await page.request.patch("/api/ryd/orders/804", { data: { status: "verified" } });
  expect(verified.ok()).toBeTruthy();
  await page.goto("/ryd?status=verified");
  await page.getByRole("checkbox", { name: "Select all 3", exact: true }).check();
  await page.getByRole("button", { name: "Generate email & CSV (3)", exact: true }).click();
  await expect(send.getByRole("link", { name: "Download CSV", exact: true })).toBeVisible();
  const calls = (await state(request)).calls;
  expect(calls.at(-1)).toMatchObject({ name: "ryd_generate_fulfillment", body: { requested_orders: expect.arrayContaining(["801", "804", "805"]) } });
  expect((await state(request)).snapshot).toEqual(oldDraft);

});

test("generates a selected batch across pages while respecting the ready filter", async ({ page, request }, testInfo) => {
  await reset(request);
  await signIn(page);
  const rows = Array.from({ length: 12 }, (_, i) => `${801 + i},Ryan,Ready${i},ready${i}@example.test,✅`);
  const imported = await page.request.post("/api/ryd/imports", { multipart: {
    operationId: "00000000-0000-4000-8000-000000000831",
    file: { name: "selection.csv", mimeType: "text/csv", buffer: Buffer.from(
      "OrderId,BillFirstName,BillLastName,BillEmail,Verified?\r\n" + rows.join("\r\n") + "\r\n900,Ryan,Existing,existing@example.test,✅\r\n",
    ) },
  } });
  expect(imported.ok()).toBeTruthy();
  expect((await page.request.post("/api/ryd/production", { data: {
    operationId: "00000000-0000-4000-8000-000000000832",
    moves: [{ orderId: "900", from: "not-started", to: "in-production" }],
  } })).ok()).toBeTruthy();
  await page.goto("/ryd?status=verified&pageSize=10");
  await expect(page.locator("table tbody tr")).toHaveCount(10);
  await expect(page.getByRole("button", { name: "Generate email & CSV (0)", exact: true })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Select all 12", exact: true }).check();
  await expect(page.getByRole("checkbox", { name: "12 of 12 selected", exact: true })).toBeChecked();
  const widths = testInfo.project.name === "chromium-mobile" ? [390] : [1024, 1280, 1536];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const generate = page.getByRole("button", { name: "Generate email & CSV (12)", exact: true });
    await generate.scrollIntoViewIfNeeded();
    await expect(generate).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`ready-selection-${width}.png`) });
  }
  await page.getByRole("button", { name: "Generate email & CSV (12)", exact: true }).click();
  const send = page.getByRole("dialog", { name: "Fulfillment email & CSV", exact: true });
  const download = send.getByRole("link", { name: "Download CSV", exact: true });
  await expect(download).toBeVisible();
  const file = await downloadedCsv(page, download);
  expect(file.trim().split(/\r?\n/)).toHaveLength(13);
  const draft = decodeURIComponent((await send.getByRole("link", { name: "Open email", exact: true }).getAttribute("href"))!);
  for (let i = 0; i < 12; i++) expect(draft).toContain(`${801 + i} · Ryan Ready${i}`);
  expect(draft).not.toContain("Ryan Existing");
  const prepared = await state(request);
  expect(prepared.snapshot).toBeNull();
  expect(prepared.calls.at(-1)).toMatchObject({ name: "ryd_generate_fulfillment", body: { requested_orders: expect.arrayContaining(["801", "812"]) } });
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
  await page.goto("/ryd?status=verified&production=all");
  const sort = page.getByRole("button", { name: "Sort by progress", exact: true });
  const header = page.getByRole("columnheader").filter({ has: sort });
  const rows = page.locator("table tbody tr");
  await sort.scrollIntoViewIfNeeded();
  await sort.press("Enter");
  await page.getByRole("menuitem", { name: "Ready to send first", exact: true }).press("Enter");
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
  await page.getByRole("menuitem", { name: "Newest start first", exact: true }).click();
  await expect(page).toHaveURL(/sort=production-sent-desc(?:&|$)/);
  await expect(header).toHaveAttribute("aria-sort", "descending");
  await expect(rows).toHaveText([/Ryan Done/, /Ryan Sent/, /Ryan Waiting/]);
  await sort.click();
  await page.getByRole("menuitem", { name: "Oldest start first", exact: true }).click();
  await expect(page).toHaveURL(/sort=production-sent(?:&|$)/);
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  const widths = testInfo.project.name === "chromium-mobile" ? [390] : [1024, 1280, 1536];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await sort.scrollIntoViewIfNeeded();
    await sort.click();
    await expect(page.getByRole("menu")).toHaveCSS("opacity", "1");
    await expect(page.getByRole("menu")).toBeInViewport();
    await expect(page.getByRole("menuitem", { name: "Newest start first", exact: true })).toBeInViewport();
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
        data: { orderIds: ["801"] },
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
