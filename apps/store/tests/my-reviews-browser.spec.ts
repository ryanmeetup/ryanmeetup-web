import { expect, test, type Page } from "@playwright/test";
import { configure, fixture, reset, signIn, state } from "./fixtures/buyer-browser";

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
