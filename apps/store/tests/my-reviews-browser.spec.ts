import { expect, test, type Page } from "@playwright/test";
import { demoProductId } from "../lib/demo-data";
import { configure, fixture, reset, signIn, state } from "./fixtures/buyer-browser";
import { customerPurchasePage } from "./fixtures/customer-purchase";
import { screenshotPath } from "./fixtures/screenshots";

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const card=(page:Page,n:number)=>page.getByTestId(`my-review-${id(n)}`);
test.beforeEach(async({page,request,baseURL})=>{await reset(request);await signIn(page,baseURL!);});

test("shows only the signed-in buyer's statuses and allowed actions",async({page})=>{
  await page.goto("/reviews/mine");await expect(page.getByRole("heading",{name:"My reviews",exact:true})).toBeVisible();
  await expect(page.locator("article[data-testid^='my-review-']")).toHaveCount(5);
  await expect(card(page,201)).toHaveCount(0);await expect(card(page,4)).toContainText("Hidden");
  await expect(card(page,4).getByRole("button",{name:/Edit your review/})).toHaveCount(0);
  await expect(card(page,4).getByRole("button",{name:/Withdraw your review/})).toHaveCount(1);
  await expect(card(page,5).getByRole("button")).toHaveCount(0);
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
  await expect(card(page,2)).toContainText("Shown as Anonymous");
  const saved=await state(request);expect(saved.calls).toHaveLength(1);expect(saved.calls[0]).toMatchObject({operation:"review.edit",subject:"buyer-a",displayName:"Anonymous"});
  expect(saved.records.find((r:{value:{id:string}})=>r.value.id===id(2)).published.body).toBe("Approved original text.");
});
test("a rejected review can be edited and withdrawal removes approved content",async({page,request})=>{
  await page.goto("/reviews/mine");await card(page,3).getByRole("button",{name:/Edit your review/}).click();
  const dialog=page.getByRole("dialog");await dialog.getByLabel("Review").fill("A revised review.");
  await dialog.getByRole("button",{name:"Save changes",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card(page,3)).toContainText("Waiting for approval");
  await card(page,2).getByRole("button",{name:/Withdraw your review/}).click();
  await page.getByRole("dialog").getByRole("button",{name:"Withdraw",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);await expect(card(page,2)).toContainText("Withdrawn");
  await expect(card(page,2).getByRole("button")).toHaveCount(0);
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
  await page.getByRole("button",{name:"Refresh reviews",exact:true}).click();
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
  await page.getByRole("button",{name:"Refresh reviews",exact:true}).click();await expect(page.locator("article[data-testid^='my-review-']")).toHaveCount(20);
  await signIn(page,baseURL!,"buyer-b");await page.getByRole("button",{name:"Load more reviews",exact:true}).click();
  await expect(page.locator("article[data-testid^='my-review-']")).toHaveCount(1);await expect(card(page,201)).toBeVisible();await expect(card(page,1)).toHaveCount(0);
});
test("forged edits, expired sessions, and Judge.me mode cannot change buyer reviews",async({page,request,baseURL})=>{
  await page.goto("/reviews/mine");
  const snapshot=await state(request);const foreign=snapshot.records.find((r:{subject:string})=>r.subject==="buyer-b").value;
  const forged=await page.request.post("/api/reviews/mine",{headers:{Origin:baseURL!},data:{action:"withdraw",reviewId:foreign.id,expectedUpdatedAt:foreign.updatedAt}});expect(forged.status()).toBe(404);
  await request.post(`${fixture}/__revoke`);await page.getByRole("button",{name:"Refresh reviews",exact:true}).click();
  await expect(page.locator("article[data-testid^='my-review-']")).toHaveCount(0);await expect(page.getByRole("link",{name:"Sign in",exact:true})).toBeVisible();
  await signIn(page,baseURL!);await page.context().addCookies([{name:"store-review-preview",value:"judgeme",url:baseURL!}]);
  await page.goto("/reviews/mine");await expect(page.getByRole("heading",{name:"My reviews",exact:true})).toHaveCount(0);
  expect((await page.request.get("/api/reviews/mine")).status()).toBe(503);expect((await state(request)).calls).toHaveLength(0);
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
        await card(page,2).getByRole("button",{name:/Edit your review/}).click();
        await expect(page.getByRole("dialog").getByLabel("Review")).toHaveValue("Review".repeat(150));
        expect(await page.getByRole("dialog").getByText("Ryan".repeat(50),{exact:true}).evaluate((element)=>element.scrollWidth<=element.clientWidth)).toBe(true);
        await page.screenshot({path:testInfo.outputPath(`my-editor-${theme}-${width}.png`)});
        await page.getByRole("dialog").getByRole("button",{name:"Cancel",exact:true}).click();
      }
    }
  }
});
test("an empty list points back to the shop, and refreshing shows a small spinner",async({page,request,baseURL})=>{
  await reset(request,{empty:true});await signIn(page,baseURL!);
  for(const theme of ["dark","light"]){
    await page.addInitScript((value)=>localStorage.setItem("theme",value),theme);
    await page.goto("/reviews/mine");
    await expect(page.getByRole("heading",{name:"No reviews yet",exact:true})).toBeVisible();
    await expect(page.getByRole("link",{name:"Browse the shop",exact:true})).toHaveAttribute("href","/");
    await page.locator("main").screenshot({path:screenshotPath(`store-my-reviews-empty-${theme}.png`)});
  }
  // Hold the refresh open long enough to measure what it shows.
  let release=()=>{};const held=new Promise<void>((resolve)=>{release=resolve;});
  await page.route("**/api/reviews/mine**",async(route)=>{await held;await route.continue();});
  await page.getByRole("button",{name:"Refresh reviews",exact:true}).click();
  const status=page.getByRole("status").filter({hasText:"Updating your reviews…"});
  await expect(status).toBeVisible();
  const spinner=await status.locator("svg").boundingBox();
  expect(spinner!.width).toBeLessThanOrEqual(20);expect(spinner!.height).toBeLessThanOrEqual(20);
  release();await expect(status).toHaveCount(0);
});
test("signed in, My reviews offers recent purchases to review and reviews them in place",async({page,request,baseURL})=>{
  await reset(request,{empty:true});
  const purchase=customerPurchasePage();purchase.order.customer.id="gid://shopify/Customer/123";
  purchase.order.lineItems.nodes[0].productId=demoProductId("ryan-meetup-tee");
  // The demo tee's options are Size then Color, so its variant title lists them in that order.
  purchase.order.lineItems.nodes[0].variantTitle="M / White";
  await configure(request,{purchase});await signIn(page,baseURL!);
  await page.goto("/reviews/mine");
  const ready=page.getByRole("region",{name:"Ready to review"});
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
  await expect(dialog).toContainText("Reviewing Order #100 · M / White");
  await dialog.getByRole("radio",{name:"5 stars",exact:true}).check();
  await dialog.getByLabel(/^Title/).fill("Wore it to the meetup");
  await dialog.getByLabel(/^Review/).fill("Every Ryan asked where I got it.");
  await dialog.getByRole("button",{name:"Submit review",exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status").filter({hasText:"Thanks!"})).toContainText("Thanks! Your review is waiting for approval.");
  await expect(page.getByRole("region",{name:"Ready to review"})).toHaveCount(0);
  await expect(page.locator("article[data-testid^='my-review-']")).toHaveCount(1);
  await expect(page.locator("article[data-testid^='my-review-']")).toContainText("Waiting for approval");
  const {calls}=await state(request);
  expect(calls).toEqual([expect.objectContaining({operation:"review.submit",subject:"buyer-a",purchase:expect.objectContaining({orderId:"100",lineId:"101"})})]);
});
