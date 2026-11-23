import { expect, test, type Page, type Locator } from "@playwright/test";
import sharp from "sharp";
import { demoProductId } from "../lib/demo-data";
import { configure, reset, signIn, state } from "./fixtures/buyer-browser";
import { customerPurchasePage } from "./fixtures/customer-purchase";

const path="/products/ryan-meetup-tee#reviews";
const savedId="00000000-0000-4000-8000-000000000900";
let png:Buffer; let webp:Buffer;
test.beforeAll(async()=>{png=await sharp({create:{width:160,height:120,channels:3,background:"#64a5c9"}}).png().toBuffer();webp=await sharp(png).webp().toBuffer();});
test.beforeEach(async({request})=>{await reset(request,{empty:true});const purchase=customerPurchasePage();purchase.order.customer.id="gid://shopify/Customer/123";purchase.order.lineItems.nodes[0].productId=demoProductId("ryan-meetup-tee");await configure(request,{purchase});});

async function photos(page:Page,options:{failUploadOnce?:boolean;failPreviewOnce?:boolean}={}){
  const uploads:{key:string;bytes:Buffer|null}[]=[];const deletes:string[]=[];let uploadFailures=options.failUploadOnce?1:0;let previewFailures=options.failPreviewOnce?1:0;
  await page.route((url)=>url.pathname==="/api/reviews/photos",async(route)=>{
    const req=route.request();const url=new URL(req.url());const viewer=req.headers()["x-review-viewer"];
    const headers={"X-Review-Viewer":viewer,"Cache-Control":"no-store"};
    if(req.method()==="POST"){
      const key=url.searchParams.get("requestKey")!;uploads.push({key,bytes:req.postDataBuffer()});
      if(uploadFailures-- >0)return route.fulfill({status:503,json:{error:"Synthetic upload failure. Retry this photo."}});
      const id=`00000000-0000-4000-8000-${String(1000+new Set(uploads.map((upload)=>upload.key)).size).padStart(12,"0")}`;
      return route.fulfill({headers,json:{status:"ready",photo:{id,width:160,height:120,expiresAt:new Date(Date.now()+3600000).toISOString()}}});
    }
    if(req.method()==="DELETE"){deletes.push(url.searchParams.get("photoId")!);return route.fulfill({headers,json:{status:"discarded"}});}
    if(previewFailures-- >0)return route.fulfill({status:503,json:{error:"Synthetic preview failure. Retry this photo."}});
    return route.fulfill({headers:{...headers,"Content-Type":"image/webp"},body:webp});
  });
  return {uploads,deletes};
}
/** A phone opens the review route, so its form stands in for the dialog. */
async function composer(page:Page){await page.goto(path);
  if((page.viewportSize()?.width??1280)<640){await page.locator("#reviews").getByRole("link",{name:"Write a review",exact:true}).click();return page.locator("main form");}
  await page.locator("#reviews").getByRole("button",{name:"Write a review",exact:true}).click();return page.getByRole("dialog",{name:"Write a review",exact:true});}
async function fill(page:Page){const dialog=page.getByRole("dialog");await dialog.getByRole("radio",{name:"5 stars",exact:true}).check();await dialog.getByRole("textbox",{name:"Title *",exact:true}).fill("Ryan with photos");await dialog.getByRole("textbox",{name:"Review *",exact:true}).fill("The photos show how it fits.");}
async function pick(dialog:Locator,files:Parameters<Locator["setInputFiles"]>[0]){const picker=dialog.getByLabel("Photos",{exact:true});await expect(picker).toBeEnabled();await picker.setInputFiles(files);}
const file=(name="shirt.png")=>({name,mimeType:"image/png",buffer:png});

test("upload, private preview and submit use raw bytes and only confirmed photo IDs",async({page,request,baseURL})=>{
  const transport=await photos(page);await signIn(page,baseURL!);const dialog=await composer(page);await fill(page);
  await pick(dialog,file());
  await expect(dialog.getByRole("img",{name:"Review photo 1",exact:true})).toBeVisible();
  expect(transport.uploads).toHaveLength(1);expect(transport.uploads[0].bytes).toEqual(png);
  expect(await dialog.getByRole("img",{name:"Review photo 1",exact:true}).getAttribute("src")).toMatch(/^blob:/);
  await dialog.getByRole("button",{name:"Submit review",exact:true}).click();await expect(page.getByText("Review received",{exact:true})).toBeVisible();await expect(dialog).toBeHidden();
  const calls=(await state(request)).calls.filter((call:{operation:string})=>call.operation==="review.submit");
  expect(calls).toHaveLength(1);expect(calls[0].photoIds).toEqual(["00000000-0000-4000-8000-000000001001"]);
});

test("a signed-in buyer without a matching order can attach photos to product feedback",async({page,request,baseURL})=>{
  await configure(request,{purchase:null});
  await photos(page);await signIn(page,baseURL!);const dialog=await composer(page);await fill(page);
  await expect(dialog).toContainText("your review shows without the Verified badge");
  await pick(dialog,file());await expect(dialog.getByRole("img",{name:"Review photo 1",exact:true})).toBeVisible();
  await dialog.getByRole("button",{name:"Submit review",exact:true}).click();
  await expect(page.getByText("Review received",{exact:true})).toBeVisible();
  const calls=(await state(request)).calls.filter((call:{operation:string})=>call.operation==="review.submit");
  expect(calls).toHaveLength(1);expect(calls[0].purchase.lineId).toBeNull();
  expect(calls[0].photoIds).toEqual(["00000000-0000-4000-8000-000000001001"]);
});

test("Ready to Review submits attachments with the selected purchase",async({page,request,baseURL})=>{
  await photos(page);await signIn(page,baseURL!);await page.goto("/reviews/mine");
  await page.getByRole("button",{name:/^Write a review of /}).first().click();
  const dialog=page.getByRole("dialog",{name:"Write a review",exact:true});await fill(page);
  await pick(dialog,file());await expect(dialog.getByRole("img",{name:"Review photo 1",exact:true})).toBeVisible();
  await dialog.getByRole("button",{name:"Submit review",exact:true}).click();await expect(dialog).toHaveCount(0);
  const calls=(await state(request)).calls.filter((call:{operation:string})=>call.operation==="review.submit");
  expect(calls).toHaveLength(1);expect(calls[0].purchase).toMatchObject({orderId:"100",lineId:"101"});
  expect(calls[0].photoIds).toEqual(["00000000-0000-4000-8000-000000001001"]);
});

test("failed uploads require an explicit retry with the same request key",async({page,baseURL})=>{
  const transport=await photos(page,{failUploadOnce:true});await signIn(page,baseURL!);const dialog=await composer(page);await fill(page);
  await pick(dialog,file());await expect(dialog.getByRole("alert")).toContainText("Synthetic upload failure");
  await expect(dialog.getByRole("button",{name:"Submit review",exact:true})).toBeDisabled();expect(transport.uploads).toHaveLength(1);
  await dialog.getByRole("button",{name:"Retry photo 1",exact:true}).click();await expect(dialog.getByRole("img",{name:"Review photo 1",exact:true})).toBeVisible();
  expect(transport.uploads).toHaveLength(2);expect(transport.uploads[1].key).toBe(transport.uploads[0].key);
});

test("preview retry does not upload twice and removing a new photo confirms discard",async({page,baseURL})=>{
  const transport=await photos(page,{failPreviewOnce:true});await signIn(page,baseURL!);const dialog=await composer(page);await fill(page);
  await pick(dialog,file());await expect(dialog.getByRole("alert")).toContainText("Synthetic preview failure");
  await dialog.getByRole("button",{name:"Retry photo 1",exact:true}).click();await expect(dialog.getByRole("img",{name:"Review photo 1",exact:true})).toBeVisible();expect(transport.uploads).toHaveLength(1);
  await dialog.getByRole("button",{name:"Remove photo 1",exact:true}).click();await expect(dialog.getByRole("img",{name:"Review photo 1",exact:true})).toHaveCount(0);expect(transport.deletes).toHaveLength(1);
  await expect(dialog.getByRole("button",{name:"Submit review",exact:true})).toBeEnabled();
});

test("five photos includes saved/new selections, and type and size limits are visible",async({page,baseURL})=>{
  const transport=await photos(page);await signIn(page,baseURL!);const dialog=await composer(page);
  await pick(dialog,{name:"bad.svg",mimeType:"image/svg+xml",buffer:Buffer.from("<svg/>")});
  await expect(dialog.getByRole("alert")).toContainText("still JPEG, PNG, WebP or HEIC");expect(transport.uploads).toHaveLength(0);
  await pick(dialog,{name:"huge.png",mimeType:"image/png",buffer:Buffer.alloc(25*1024*1024+1)});
  await expect(dialog.getByRole("alert")).toContainText("25 MB or smaller");
  await pick(dialog,Array.from({length:5},(_,index)=>file(`photo-${index}.png`)));
  await expect(dialog.getByRole("img",{name:"Review photo 5",exact:true})).toBeVisible();await expect(dialog.getByLabel("Photos",{exact:true})).toBeDisabled();expect(transport.uploads).toHaveLength(5);
});

test("an account change clears previews and blocks the old form without submitting",async({page,request,baseURL})=>{
  await photos(page);await signIn(page,baseURL!);const dialog=await composer(page);await fill(page);await pick(dialog,file());
  await expect(dialog.getByRole("img",{name:"Review photo 1",exact:true})).toBeVisible();
  await signIn(page,baseURL!,"buyer-b");await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
  await expect(dialog.getByText(/Your account changed/)).toBeVisible();await expect(dialog.getByRole("img",{name:"Review photo 1",exact:true})).toHaveCount(0);
  await expect(dialog.getByRole("button",{name:"Submit review",exact:true})).toBeDisabled();
  expect((await state(request)).calls.filter((call:{operation:string})=>call.operation==="review.submit")).toHaveLength(0);
});

test("edits load the matching saved selection; removal changes the pending revision without deleting history",async({page,request,baseURL})=>{
  await reset(request);await configure(request,{photos:{"00000000-0000-4000-8000-000000000002":[{id:savedId,width:160,height:120}]}});
  const transport=await photos(page);await signIn(page,baseURL!);await page.goto("/reviews/mine");await page.getByRole("button",{name:"Edit your review of Fixture shirt 2",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Edit your review",exact:true});
  await expect(dialog.getByRole("img",{name:"Review photo 1",exact:true})).toBeVisible();await dialog.getByRole("button",{name:"Remove photo 1",exact:true}).click();
  await dialog.getByRole("button",{name:"Save changes",exact:true}).click();await expect(page.getByText("Saved. Your changes are waiting for approval.",{exact:true})).toBeVisible();await expect(dialog).toBeHidden();
  const result=await state(request);const edit=result.calls.find((call:{operation:string})=>call.operation==="review.edit");expect(edit.photoIds).toEqual([]);expect(transport.deletes).toEqual([]);
  expect(result.records.find((record:{value:{id:string}})=>record.value.id.endsWith("000000000002")).published.body).toBe("Approved original text.");
});

test("a changed selection version blocks saving instead of pairing old text with new photos",async({page,request,baseURL})=>{
  await reset(request);await photos(page);await signIn(page,baseURL!);await page.goto("/reviews/mine");await configure(request,{photoVersion:"2026-11-20T00:00:00.123456Z"});
  await page.getByRole("button",{name:"Edit your review of Fixture shirt 2",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Edit your review",exact:true});
  await expect(dialog.getByText(/This review changed/)).toBeVisible();await expect(dialog.getByRole("button",{name:"Save changes",exact:true})).toBeDisabled();
  expect((await state(request)).calls.filter((call:{operation:string})=>call.operation==="review.edit")).toHaveLength(0);
});

for(const theme of ["light","dark"])for(const width of [390,1024,1280,1536]){
  test(`private photo editor fits ${theme} at ${width}px`,async({page,baseURL},testInfo)=>{
    await photos(page);await signIn(page,baseURL!);await page.addInitScript((theme)=>localStorage.setItem("theme",theme),theme);await page.setViewportSize({width,height:1000});
    const dialog=await composer(page);await pick(dialog,[file("front.png"),file("back.png")]);await expect(dialog.getByRole("img",{name:"Review photo 2",exact:true})).toBeVisible();
    await dialog.getByRole("img",{name:"Review photo 2",exact:true}).scrollIntoViewIfNeeded();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`photo-editor-${theme}-${width}.png`)});
  });
}

test("closing revokes preview URLs and reopening resumes the same upload without uploading again",async({page,baseURL})=>{
  const transport=await photos(page);await signIn(page,baseURL!);const dialog=await composer(page);await pick(dialog,file());
  const image=dialog.getByRole("img",{name:"Review photo 1",exact:true});await expect(image).toBeVisible();const first=await image.getAttribute("src");
  await dialog.getByRole("button",{name:"Cancel",exact:true}).click();await expect(dialog).toBeHidden();
  expect(await page.evaluate(async(url)=>{try{await fetch(url!);return false;}catch{return true;}},first)).toBe(true);
  await page.locator("#reviews").getByRole("button",{name:"Write a review",exact:true}).click();await expect(image).toBeVisible();
  expect(await image.getAttribute("src")).not.toBe(first);expect(transport.uploads).toHaveLength(1);
});

test("an account change during an upload prevents the late response from restoring a preview",async({page,baseURL})=>{
  await photos(page);let started!:()=>void;let release!:()=>void;
  const began=new Promise<void>((resolve)=>{started=resolve;});const blocked=new Promise<void>((resolve)=>{release=resolve;});
  await page.route((url)=>url.pathname==="/api/reviews/photos",async(route)=>{
    if(route.request().method()==="POST"){started();await blocked;}
    await route.fallback().catch(()=>{});
  });
  await signIn(page,baseURL!);const dialog=await composer(page);await pick(dialog,file());await began;
  await signIn(page,baseURL!,"buyer-b");await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
  try{await expect(dialog.getByText(/Your account changed/)).toBeVisible();}finally{release();}
  await expect(dialog.getByRole("img",{name:"Review photo 1",exact:true})).toHaveCount(0);
  await expect(dialog.getByRole("button",{name:"Submit review",exact:true})).toBeDisabled();
});

test("hiding the page clears previews and validates the viewer before showing them again",async({page,baseURL})=>{
  await photos(page);await signIn(page,baseURL!);const dialog=await composer(page);await pick(dialog,file());
  await expect(dialog.getByRole("img",{name:"Review photo 1",exact:true})).toBeVisible();
  await page.evaluate(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,value:"hidden"});document.dispatchEvent(new Event("visibilitychange"));});
  await expect(dialog.getByRole("img",{name:"Review photo 1",exact:true})).toHaveCount(0);
  await signIn(page,baseURL!,"buyer-b");
  await page.evaluate(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,value:"visible"});document.dispatchEvent(new Event("visibilitychange"));});
  await expect(dialog.getByText(/Your account changed/)).toBeVisible();await expect(dialog.getByRole("img",{name:"Review photo 1",exact:true})).toHaveCount(0);
});
