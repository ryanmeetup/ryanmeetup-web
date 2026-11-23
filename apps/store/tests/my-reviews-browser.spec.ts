import { expect, test, type Page } from "@playwright/test";
import { demoProductId } from "../lib/demo-data";
import { configure, fixture, reset, signIn, state } from "./fixtures/buyer-browser";
import { customerPurchasePage } from "./fixtures/customer-purchase";
import { screenshotPath } from "./fixtures/screenshots";

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const card=(page:Page,n:number)=>page.getByTestId(`my-review-${id(n)}`);
function reminderPurchase(orderId = "100", lineId = "101") {
  const purchase = customerPurchasePage();
  purchase.order.customer.id = "gid://shopify/Customer/123";
  purchase.order.id = `gid://shopify/Order/${orderId}`;
  purchase.order.name = `#${orderId}`;
  purchase.order.lineItems.nodes[0].id = `gid://shopify/LineItem/${lineId}`;
  purchase.order.lineItems.nodes[0].productId = demoProductId("ryan-meetup-tee");
  purchase.order.fulfillments.nodes[0].fulfillmentLineItems.nodes[0].lineItem.id = `gid://shopify/LineItem/${lineId}`;
  return purchase;
}
test.beforeEach(async({page,request,baseURL})=>{await reset(request);await signIn(page,baseURL!);});

test("review reminder dismissals survive reloads and sessions, preserve other purchases and can be restored", async ({ page, request, baseURL }) => {
  await configure(request, { purchases: [reminderPurchase(), reminderPurchase("200", "202")] });
  await page.goto("/reviews/mine");
  const ready = page.getByRole("region", { name: /^Ready to Review/ });
  const first = ready.getByRole("listitem").filter({ hasText: "#100" });
  const second = ready.getByRole("listitem").filter({ hasText: "#200" });
  await first.getByRole("button", { name: /^Dismiss review reminder/ }).click();
  await expect(ready.getByRole("button", { name: "Dismissed (1)", exact: true })).toBeVisible();
  await expect(ready.getByRole("button", { name: /^Write a review of/ })).toHaveCount(1);
  await expect(second.getByRole("button", { name: /^Write a review of/ })).toBeVisible();
  await page.reload();
  await expect(ready.getByRole("button", { name: /^Write a review of/ })).toHaveCount(1);
  await signIn(page, baseURL!, "buyer-b");
  await page.reload();
  await expect(ready.getByRole("button", { name: /^Write a review of/ })).toHaveCount(2);
  await signIn(page, baseURL!);
  await page.reload();
  await expect(ready.getByRole("button", { name: /^Write a review of/ })).toHaveCount(1);
  await ready.getByRole("button", { name: "Dismissed (1)", exact: true }).click();
  await first.getByRole("button", { name: /^Restore review reminder/ }).click();
  await expect(ready.getByRole("button", { name: /^Write a review of/ })).toHaveCount(2);
  await page.reload();
  await expect(ready.getByRole("button", { name: /^Write a review of/ })).toHaveCount(2);
  expect((await state(request)).dismissals).toEqual([]);
});

test("a dismissed purchase can still be reviewed from its product page", async ({ page, request }) => {
  await configure(request, { purchase: reminderPurchase() });
  await page.goto("/reviews/mine");
  await page.getByRole("button", { name: /^Dismiss review reminder/ }).click();
  await page.getByRole("button", { name: "Dismissed (1)", exact: true }).click();
  await page.getByRole("region", { name: /^Ready to Review/ }).getByRole("link", { name: "Official Ryan Meetup Tee", exact: true }).click();
  await expect(page.getByRole("button", { name: "Write a review", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Write a review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Write a review", exact: true });
  await expect(dialog.getByRole("button", { name: "Submit review", exact: true })).toBeVisible();
  await dialog.getByRole("radio", { name: "5 stars", exact: true }).check();
  await dialog.getByLabel(/^Title/).fill("Still worth a review");
  await dialog.getByLabel(/^Review/).fill("I changed my mind after dismissing the reminder.");
  await dialog.getByRole("button", { name: "Submit review", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto("/reviews/mine");
  await expect(page.getByRole("heading", { name: /^Ready to Review/ })).toHaveCount(0);
});

test("review reminder failures preserve the item and pending changes cannot be submitted twice", async ({ page, request }) => {
  await configure(request, { purchase: reminderPurchase() });
  await page.goto("/reviews/mine");
  const dismiss = page.getByRole("button", { name: /^Dismiss review reminder/ });
  await configure(request, { failDismissals: true });
  await dismiss.click();
  await expect(page.getByRole("alert").filter({ hasText: "could not be updated" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Write a review of/ })).toBeEnabled();
  await configure(request, { failDismissals: false });
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/reviews/suggestions", async (route) => { await held; await route.continue(); });
  await dismiss.click();
  await expect(dismiss).toBeDisabled();
  await expect(page.getByRole("button", { name: /^Write a review of/ })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Updating your review reminders" })).toBeVisible();
  release();
  await expect(page.getByRole("button", { name: "Dismissed (1)", exact: true })).toBeVisible();
  await page.unroute("**/api/reviews/suggestions");
  expect((await state(request)).dismissals).toHaveLength(1);
});

test("review reminders keep dismiss and restore usable at mobile and desktop boundaries in both themes", async ({ page, request }, testInfo) => {
  await configure(request, { purchase: reminderPurchase() });
  for (const theme of ["light", "dark"]) {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    // The Store forces dark mode. Override only the hydrated test DOM to
    // exercise the shared light-theme classes without changing the product setting.
    const showTheme = () => page.evaluate((value) => {
      document.documentElement.classList.toggle("dark", value === "dark");
      document.documentElement.classList.toggle("light", value === "light");
      document.documentElement.style.colorScheme = value;
    }, theme);
    for (const width of [390, 1024, 1280, 1536]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/reviews/mine");
      await page.getByRole("button", { name: /^Dismiss review reminder/ }).focus();
      await page.getByRole("button", { name: /^Dismiss review reminder/ }).press("Enter");
      await expect(page.getByRole("heading", { name: /^Ready to Review/ })).toContainText("0 items");
      await page.getByRole("button", { name: "Dismissed (1)", exact: true }).click();
      const restore = page.getByRole("button", { name: /^Restore review reminder/ });
      await expect(restore).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await showTheme();
      await page.getByRole("region", { name: /^Ready to Review/ }).screenshot({ path: testInfo.outputPath(`reminders-dismissed-${theme}-${width}.png`) });
      await restore.click();
      await expect(page.getByRole("button", { name: /^Dismiss review reminder/ })).toBeVisible();
      await showTheme();
      await page.getByRole("region", { name: /^Ready to Review/ }).screenshot({ path: testInfo.outputPath(`reminders-ready-${theme}-${width}.png`) });
    }
  }
});

test("published reviews link to their exact public review, including a waiting edit", async ({ page, request }, testInfo) => {
  const snapshot = await state(request);
  const records = snapshot.records;
  for (const record of records) record.value.item.productId = demoProductId("ryans-dad-name-tag-shirt").split("/").at(-1)!;
  await reset(request, { records, keepSessions: true });
  for (const theme of ["light", "dark"]) {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/reviews/mine");
      const link = card(page, 2).getByRole("link", { name: "View your review of Fixture shirt 2", exact: true });
      await expect(link).toHaveAttribute("href", `/products/name-tag-shirt?design=ryans-dad-name-tag-shirt#review-${id(2)}`);
      await expect(card(page, 2)).toContainText("Edit waiting for approval");
      for (const n of [1, 3, 4, 5]) await expect(card(page, n).getByRole("link", { name: /View your review of/ })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await card(page, 2).screenshot({ path: testInfo.outputPath(`published-review-link-${theme}-${width}.png`) });
    }
  }
  await card(page, 2).getByRole("link", { name: /View your review of/ }).click();
  await expect(page).toHaveURL(new RegExp(`/products/name-tag-shirt\\?design=ryans-dad-name-tag-shirt#review-${id(2)}$`));
});

test("shows only the signed-in buyer's statuses and allowed actions",async({page})=>{
  await page.goto("/reviews/mine");await expect(page.getByRole("heading",{name:"My Reviews",exact:true})).toBeVisible();
  await expect(page.locator("article[data-testid^='my-review-']")).toHaveCount(5);
  await expect(card(page,201)).toHaveCount(0);await expect(card(page,4)).toContainText("Hidden");
  await expect(card(page,4).getByRole("button",{name:/Edit your review/})).toHaveCount(0);
  await expect(card(page,4).getByRole("button",{name:/Withdraw your review/})).toHaveCount(1);
  // A withdrawn review offers no actions; only the badge's info button remains.
  await expect(card(page,5).getByRole("button",{name:/your review/})).toHaveCount(0);
});
test("editing retains approved content, uses the selected public name, and waits for moderation",async({page,request})=>{
  await page.goto("/reviews/mine");await card(page,2).getByRole("button",{name:/Edit your review/}).click();
  const dialog=page.getByRole("dialog",{name:"Edit your review",exact:true});
  await dialog.getByLabel("Review",{exact:false}).fill("Updated after another wash.");
  await dialog.getByRole("button",{name:/Show my name as/}).click();
  await page.getByRole("option",{name:"Anonymous: Anonymous",exact:true}).click();
  await expect(dialog).toContainText("Shown publicly as Anonymous");
  await dialog.getByRole("button",{name:"Save changes",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card(page,2)).toContainText("Updated after another wash.");
  await expect(card(page,2)).toContainText("published version stays up");
  await expect(card(page,2)).toContainText(/Posted as\s*Anonymous/);
  const saved=await state(request);expect(saved.calls).toHaveLength(1);expect(saved.calls[0]).toMatchObject({operation:"review.edit",subject:"buyer-a",displayName:"Anonymous"});
  expect(saved.records.find((r:{value:{id:string}})=>r.value.id===id(2)).published.body).toBe("Approved original text.");
});
test("on a phone, editing opens its own page and saving confirms there",async({page,request})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/reviews/mine");await card(page,2).getByRole("link",{name:/Edit your review/}).click();
  await expect(page).toHaveURL(new RegExp(`/reviews/mine/${id(2)}/edit$`));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const form=page.locator("main form");
  await expect(page.getByRole("heading",{level:1,name:"Edit your review",exact:true})).toBeVisible();
  await form.getByLabel("Review",{exact:false}).fill("Edited from my phone.");
  await form.getByRole("button",{name:"Save changes",exact:true}).click();
  await expect(page.getByRole("heading",{level:1,name:"Changes saved",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Back to My reviews",exact:true}).click();
  await expect(card(page,2)).toContainText("Edited from my phone.");
  const saved=await state(request);expect(saved.calls).toEqual([expect.objectContaining({operation:"review.edit",subject:"buyer-a"})]);
});
test("another buyer's review, or none at all, has no edit page",async({page})=>{
  expect((await page.goto(`/reviews/mine/${id(999)}/edit`))?.status()).toBe(404);
  expect((await page.goto("/reviews/mine/not-a-review/edit"))?.status()).toBe(404);
});
test("a rejected review can be edited and withdrawal removes approved content",async({page,request})=>{
  await page.goto("/reviews/mine");
  // The buyer reads staff's reason, which a resubmission clears.
  await expect(card(page,3)).toContainText("Please keep it about the shirt.");
  await card(page,3).getByRole("button",{name:/Edit your review/}).click();
  const dialog=page.getByRole("dialog");await dialog.getByLabel("Review").fill("A revised review.");
  await dialog.getByRole("button",{name:"Save changes",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card(page,3)).toContainText("Waiting for approval");await expect(card(page,3)).not.toContainText("Please keep it about the shirt.");
  await card(page,2).getByRole("button",{name:/Withdraw your review/}).click();
  await page.getByRole("dialog").getByRole("button",{name:"Withdraw",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);await expect(card(page,2)).toContainText("Withdrawn");
  await expect(card(page,2).getByRole("button",{name:/your review/})).toHaveCount(0);
  expect((await state(request)).records.find((r:{value:{id:string}})=>r.value.id===id(2)).published).toBeNull();
});
test("stale edits reload the latest text without retrying the write",async({page,request})=>{
  await configure(request,{conflictOnce:true});await page.goto("/reviews/mine");
  await card(page,1).getByRole("button",{name:/Edit your review/}).click();
  await page.getByRole("dialog").getByLabel("Review").fill("An old editor's text.");
  await page.getByRole("dialog").getByRole("button",{name:"Save changes",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alert").filter({hasText:"check the latest text"})).toBeVisible();
  await expect(card(page,1)).toContainText("A newer buyer edit.");expect((await state(request)).calls).toHaveLength(1);
});
test("uncertain withdrawal clears stale actions and a refresh confirms the saved result",async({page,request})=>{
  await page.goto("/reviews/mine");await page.route("**/api/reviews/mine",async(route)=>{
    if(route.request().method()==="POST"){await route.fetch();await route.abort("failed");}else await route.continue();
  });
  await card(page,2).getByRole("button",{name:/Withdraw your review/}).click();
  await page.getByRole("dialog").getByRole("button",{name:"Withdraw",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alert").filter({hasText:"could not confirm"})).toBeVisible();
  await expect(page.locator("article[data-testid^='my-review-']")).toHaveCount(0);
  await page.unroute("**/api/reviews/mine");
  // Hold the refresh open long enough to measure what it shows.
  let release=()=>{};const held=new Promise<void>((resolve)=>{release=resolve;});
  await page.route("**/api/reviews/mine**",async(route)=>{await held;await route.continue();});
  await page.getByRole("button",{name:"Refresh reviews",exact:true}).click();
  const status=page.getByRole("status").filter({hasText:"Updating your reviews…"});
  await expect(status).toBeVisible();
  const spinner=await status.locator("svg").boundingBox();
  expect(spinner!.width).toBeLessThanOrEqual(20);expect(spinner!.height).toBeLessThanOrEqual(20);
  release();await expect(status).toHaveCount(0);
  await expect(card(page,2)).toContainText("Withdrawn");expect((await state(request)).calls).toHaveLength(1);
});
test("a confirmed edit with failed reload remains saved and blocks further decisions",async({page,request})=>{
  await configure(request,{failReadAfterSave:true});await page.goto("/reviews/mine");
  await card(page,1).getByRole("button",{name:/Edit your review/}).click();
  await page.getByRole("dialog").getByLabel("Review").fill("Confirmed edit.");
  await page.getByRole("dialog").getByRole("button",{name:"Save changes",exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"Your change was saved"})).toBeVisible();
  await expect(page.locator("article[data-testid^='my-review-']")).toHaveCount(0);
  await configure(request,{failRead:false,failReadAfterSave:false});await page.getByRole("button",{name:"Refresh reviews",exact:true}).click();
  await expect(card(page,1)).toContainText("Confirmed edit.");expect((await state(request)).calls).toHaveLength(1);
});
test("pages beyond 100 reviews and never merges another buyer's page",async({page,request,baseURL})=>{
  await reset(request,{many:true});await signIn(page,baseURL!);await page.goto("/reviews/mine");
  await expect(page.locator("article[data-testid^='my-review-']")).toHaveCount(20);
  for(let pageNumber=0;pageNumber<6;pageNumber++)await page.getByRole("button",{name:"Load more reviews",exact:true}).click();
  await expect(page.locator("article[data-testid^='my-review-']")).toHaveCount(125);
  await expect(page.getByRole("button",{name:"Load more reviews",exact:true})).toHaveCount(0);
  await page.reload();await expect(page.locator("article[data-testid^='my-review-']")).toHaveCount(20);
  await signIn(page,baseURL!,"buyer-b");await page.getByRole("button",{name:"Load more reviews",exact:true}).click();
  await expect(page.locator("article[data-testid^='my-review-']")).toHaveCount(1);await expect(card(page,201)).toBeVisible();await expect(card(page,1)).toHaveCount(0);
});
test("forged edits and expired sessions cannot change buyer reviews",async({page,request,baseURL})=>{
  await page.goto("/reviews/mine");
  const snapshot=await state(request);const foreign=snapshot.records.find((r:{subject:string})=>r.subject==="buyer-b").value;
  const forged=await page.request.post("/api/reviews/mine",{headers:{Origin:baseURL!},data:{action:"withdraw",reviewId:foreign.id,expectedUpdatedAt:foreign.updatedAt}});expect(forged.status()).toBe(404);
  await request.post(`${fixture}/__revoke`);await page.reload();
  await expect(page.locator("article[data-testid^='my-review-']")).toHaveCount(0);await expect(page.getByRole("link",{name:"Sign in",exact:true})).toBeVisible();
});
test("fits the private list and editor across mobile/desktop boundaries in both themes",async({page,request,baseURL},testInfo)=>{
  await reset(request,{longText:true});await signIn(page,baseURL!);
  for(const theme of ["light","dark"]){
    await page.addInitScript((value)=>localStorage.setItem("theme",value),theme);
    for(const width of [390,1024,1280,1536]){
      await page.setViewportSize({width,height:1000});await page.goto("/reviews/mine");await expect(card(page,2)).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
      await page.screenshot({path:testInfo.outputPath(`my-reviews-${theme}-${width}.png`),fullPage:true});
      if(width===390||width===1280){
        // A phone edits on its own page; a wider screen in the dialog.
        const phone=width<640;
        await card(page,2).getByRole(phone ? "link" : "button",{name:/Edit your review/}).click();
        if(phone) await expect(page).toHaveURL(/\/reviews\/mine\/[0-9a-f-]+\/edit$/);
        const editor=phone ? page.locator("main form") : page.getByRole("dialog");
        await expect(editor.getByLabel("Review")).toHaveValue("Review".repeat(150));
        expect(await editor.getByText("Ryan".repeat(50),{exact:true}).evaluate((element)=>element.scrollWidth<=element.clientWidth)).toBe(true);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
        await page.screenshot({path:testInfo.outputPath(`my-editor-${theme}-${width}.png`),fullPage:phone});
        await editor.getByRole("button",{name:"Cancel",exact:true}).click();
        if(phone) await expect(page).toHaveURL(/\/reviews\/mine$/);
      }
    }
  }
});
test("an empty list points back to the shop",async({page,request,baseURL})=>{
  await reset(request,{empty:true});await signIn(page,baseURL!);
  for(const theme of ["dark","light"]){
    await page.addInitScript((value)=>localStorage.setItem("theme",value),theme);
    await page.goto("/reviews/mine");
    await expect(page.getByRole("heading",{name:"No reviews yet",exact:true})).toBeVisible();
    await expect(page.getByRole("link",{name:"Browse the shop",exact:true})).toHaveAttribute("href","/");
    await page.locator("main").screenshot({path:screenshotPath(`store-my-reviews-empty-${theme}.png`)});
  }
});
test("signed in, My reviews offers recent purchases to review and reviews them in place",async({page,request,baseURL})=>{
  await reset(request,{empty:true});
  const purchase=customerPurchasePage();purchase.order.customer.id="gid://shopify/Customer/123";
  purchase.order.lineItems.nodes[0].productId=demoProductId("ryan-meetup-tee");
  // The demo tee's options are Size then Color, so its variant title lists them in that order.
  purchase.order.lineItems.nodes[0].variantTitle="M / White";
  await configure(request,{purchase});await signIn(page,baseURL!);
  await page.goto("/reviews/mine");
  const ready=page.getByRole("region",{name:"Ready to Review"});
  await expect(ready.getByRole("heading",{name:"Official Ryan Meetup Tee"})).toBeVisible();
  // One labelled line per option and order fact, not a run-on label.
  const details=ready.locator("dl");
  for(const [label,value] of [["Size","M"],["Color","White"],["Order","#100"],["Shipped","Nov 16, 2026"]] as const){
    await expect(details.locator("dt",{hasText:label}).locator("xpath=following-sibling::dd[1]")).toHaveText(value);
  }
  await expect(details).not.toContainText("Qty");
  // With something to review, the empty-state card would only repeat the invitation.
  await expect(page.getByRole("heading",{name:"No reviews yet",exact:true})).toHaveCount(0);
  await page.screenshot({path:screenshotPath("my-reviews-ready-to-review.png"),fullPage:true});

  await ready.getByRole("button",{name:"Write a review of Official Ryan Meetup Tee",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Write a review",exact:true});
  // The same labelled order and variant rows as the card it came from.
  await expect(dialog.getByText("#100",{exact:true})).toBeVisible();
  await expect(dialog).toContainText("White");
  await expect(dialog).not.toContainText("Tell other Ryans");
  await dialog.getByRole("radio",{name:"5 stars",exact:true}).check();
  await dialog.getByLabel(/^Title/).fill("Wore it to the meetup");
  await dialog.getByLabel(/^Review/).fill("Every Ryan asked where I got it.");
  await dialog.getByRole("button",{name:"Submit review",exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status").filter({hasText:"Thanks!"})).toContainText("Thanks! Your review is waiting for approval.");
  await expect(page.getByRole("region",{name:"Ready to Review"})).toHaveCount(0);
  await expect(page.locator("article[data-testid^='my-review-']")).toHaveCount(1);
  await expect(page.locator("article[data-testid^='my-review-']")).toContainText("Waiting for approval");
  const {calls}=await state(request);
  expect(calls).toEqual([expect.objectContaining({operation:"review.submit",subject:"buyer-a",purchase:expect.objectContaining({orderId:"100",lineId:"101"})})]);
});
test("on a phone, Ready to Review writes on the product's review page and returns to My reviews",async({page,request,baseURL})=>{
  await reset(request,{empty:true});await configure(request,{purchase:reminderPurchase()});await signIn(page,baseURL!);
  await page.setViewportSize({width:390,height:844});
  await page.goto("/reviews/mine");
  const ready=page.getByRole("region",{name:"Ready to Review"});
  await ready.getByRole("link",{name:"Write a review of Official Ryan Meetup Tee",exact:true}).click();
  await expect(page).toHaveURL(/\/products\/ryan-meetup-tee\/review\?order=100&from=mine$/);
  const form=page.locator("main form");
  await expect(form.getByText("#100",{exact:true})).toBeVisible();
  await form.getByRole("radio",{name:"4 stars",exact:true}).check();
  await form.getByLabel(/^Title/).fill("Phone-written");
  await form.getByLabel(/^Review/).fill("Wrote this on the train.");
  await form.getByRole("button",{name:"Submit review",exact:true}).click();
  await expect(page.getByRole("heading",{level:1,name:"Review received",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Back to My reviews",exact:true}).click();
  await expect(page.getByRole("region",{name:"Ready to Review"})).toHaveCount(0);
  await expect(page.locator("article[data-testid^='my-review-']")).toContainText("Waiting for approval");
  const {calls}=await state(request);
  expect(calls).toEqual([expect.objectContaining({operation:"review.submit",purchase:expect.objectContaining({orderId:"100",lineId:"101"})})]);
});
test("Ready to review and Your reviews each fold away under a real heading",async({page,request,baseURL})=>{
  await reset(request);
  const purchase=customerPurchasePage();purchase.order.customer.id="gid://shopify/Customer/123";
  purchase.order.lineItems.nodes[0].productId=demoProductId("ryan-meetup-tee");
  purchase.order.lineItems.nodes[0].variantTitle="M / White";
  await configure(request,{purchase});await signIn(page,baseURL!);
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:900});
    await page.goto("/reviews/mine");
    const ready=page.getByRole("heading",{level:2,name:/^Ready to Review/}).getByRole("button");
    const yours=page.getByRole("heading",{level:2,name:/^Your Reviews/}).getByRole("button");
    await expect(ready).toHaveAttribute("aria-expanded","true");await expect(yours).toHaveAttribute("aria-expanded","true");
    // Nothing went wrong, so there is nothing to refresh.
    await expect(page.getByRole("button",{name:"Refresh reviews",exact:true})).toHaveCount(0);
    await page.screenshot({path:screenshotPath(`my-reviews-sections-open-${width}.png`),fullPage:true});
    await ready.click();
    await expect(ready).toHaveAttribute("aria-expanded","false");
    await expect(page.getByRole("button",{name:"Write a review of Official Ryan Meetup Tee"})).toHaveCount(0);
    await yours.click();
    await expect(yours).toHaveAttribute("aria-expanded","false");
    // The shared panel stays mounted to animate; closed, it is aria-hidden and inert, so reviews leave the accessibility tree.
    await expect(page.getByRole("article",{name:/^Your review of/})).toHaveCount(0);
    await page.screenshot({path:screenshotPath(`my-reviews-sections-closed-${width}.png`),fullPage:true});
    await yours.click();await expect(page.locator("article[data-testid^='my-review-']").first()).toBeVisible();
  }
});
