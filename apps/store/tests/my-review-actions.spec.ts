import { expect, test } from "@playwright/test";
import { encodeBuyerReviewCursor, reviewCommandSchema } from "@ryanmeetup/reviews";
import type { BuyerReview, ReviewCommand } from "@ryanmeetup/reviews";
import { handleMyReviewAction, handleMyReviewPage, loadMyReviewPage } from "../lib/my-review-actions";
import type { ReviewBackend } from "../lib/review-backend";
import { buyerReviewNameChoices, myReviewViewSchema } from "../lib/my-review-view";
import type { CustomerSessionResult } from "../lib/customer-account/session";
import type { CustomerAccountSession } from "../lib/customer-account/storage";

const session = { sessionHash:"a".repeat(64),subject:"synthetic-buyer",createdAt:1,expiresAt:2,accessExpiresAt:2,revision:0,tokens:{accessToken:"a",refreshToken:"r",idToken:"i"} } as CustomerAccountSession;
const signedIn:CustomerSessionResult={status:"authenticated",session};
const reviewId="3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b";
const version="2026-11-17T12:00:00.123456Z";
const mine:BuyerReview={id:reviewId,lineId:"1",item:{productId:"100",productTitle:"Name Tag Shirt",variantTitle:null},
  status:"published",hasPendingEdit:false,publishedAt:"2026-11-17T12:00:00.123Z",createdAt:version,updatedAt:version,
  current:{rating:5,title:"Ryan approved",body:"Great shirt.",nameStyle:"first-initial",displayName:"Ryan L."}};
const edit={action:"edit",reviewId,expectedUpdatedAt:version,rating:4,title:"Ryan approved",body:"  Faded a little. ",nameStyle:"first-initial"};
function request(body:unknown,headers:HeadersInit={}) {
  return new Request("https://store.test/api/reviews/mine",{method:"POST",headers:{"content-type":"application/json",origin:"https://store.test",host:"store.test","x-forwarded-proto":"https",...headers},body:JSON.stringify(body)});
}
function setup({sessions=[signedIn],name=null as {firstName:string;lastName:string}|null,existing=mine as BuyerReview|null,
  editOutcome="pending",withdrawOutcome="withdrawn"}: {sessions?:CustomerSessionResult[];name?:{firstName:string;lastName:string}|null;existing?:BuyerReview|null;editOutcome?:"pending"|"closed"|"conflict"|"not_found";withdrawOutcome?:"withdrawn"|"conflict"|"not_found"}={}) {
  const commands:ReviewCommand[]=[];
  let loads=0;
  // Command-level storage fake; the database mapping itself is covered in review-backend.spec.ts.
  const backend=(async(sent:ReviewCommand)=>{
    const command=reviewCommandSchema(sent);
    if(!command)throw new Error("Invalid outgoing command");
    commands.push(command);
    return command.operation==="review.mine"?existing:command.operation==="reviews.mine"?{reviews:existing?[existing]:[],nextCursor:null}:
      command.operation==="review.edit"?editOutcome:command.operation==="review.withdraw"?withdrawOutcome:null;
  }) as ReviewBackend;
  return {commands,deps:{loadSession:async()=>sessions[Math.min(loads++,sessions.length-1)],findBuyerName:async()=>name,backend}};
}
const writes=(commands:ReviewCommand[])=>commands.filter((c)=>c.operation==="review.edit"||c.operation==="review.withdraw");

test("an edit keeps its stored public name and exact version, then waits for approval",async()=>{
  const {commands,deps}=setup();const response=await handleMyReviewAction(request(edit),deps);
  expect(response.status).toBe(200);expect(await response.json()).toEqual({status:"pending"});
  expect(commands[0]).toEqual({operation:"review.mine",subject:"synthetic-buyer",reviewId});
  expect(commands.at(-1)).toEqual({operation:"review.edit",subject:"synthetic-buyer",reviewId,expectedUpdatedAt:version,
    submission:{rating:4,title:"Ryan approved",body:"Faded a little.",nameStyle:"first-initial"},displayName:"Ryan L."});
});
test("anonymous names work without Shopify; changing named styles requires a verified current name",async()=>{
  const anon=setup();expect((await handleMyReviewAction(request({...edit,nameStyle:"anonymous"}),anon.deps)).status).toBe(200);
  expect(anon.commands.at(-1)).toMatchObject({displayName:"Anonymous"});
  const unknown=setup();expect((await handleMyReviewAction(request({...edit,nameStyle:"full"}),unknown.deps)).status).toBe(503);expect(writes(unknown.commands)).toHaveLength(0);
  const known=setup({name:{firstName:"Ryan",lastName:"Le"}});expect((await handleMyReviewAction(request({...edit,nameStyle:"full"}),known.deps)).status).toBe(200);expect(known.commands.at(-1)).toMatchObject({displayName:"Ryan Le"});
  const choices=buyerReviewNameChoices(mine,{firstName:"Ryan",lastName:"Changed"});
  expect(choices.find((c)=>c.style==="first-initial")?.displayName).toBe("Ryan L.");
});
test("withdrawal uses the owned review and an exact expected version",async()=>{
  const {commands,deps}=setup();expect((await handleMyReviewAction(request({action:"withdraw",reviewId,expectedUpdatedAt:version}),deps)).status).toBe(200);
  expect(commands.at(-1)).toEqual({operation:"review.withdraw",subject:"synthetic-buyer",reviewId,expectedUpdatedAt:version});
  expect((await handleMyReviewAction(request({action:"withdraw",reviewId,expectedUpdatedAt:version}),setup({withdrawOutcome:"not_found"}).deps)).status).toBe(404);
});
test("another buyer, stale version, closed review, and forged fields are refused",async()=>{
  expect((await handleMyReviewAction(request(edit),setup({existing:null}).deps)).status).toBe(404);
  expect((await handleMyReviewAction(request({...edit,expectedUpdatedAt:"2026-11-17T12:00:00.123455Z"}),setup().deps)).status).toBe(409);
  expect((await handleMyReviewAction(request(edit),setup({editOutcome:"closed"}).deps)).status).toBe(409);
  expect((await handleMyReviewAction(request(edit),setup({editOutcome:"conflict"}).deps)).status).toBe(409);
  const {commands,deps}=setup();
  for(const body of [{...edit,action:"approve"},{...edit,subject:"other"},{...edit,displayName:"Other"},{...edit,rating:7},{...edit,expectedUpdatedAt:version.slice(0,23)+"Z"},{action:"withdraw",reviewId,expectedUpdatedAt:version,body:"x"}])expect((await handleMyReviewAction(request(body),deps)).status).toBe(400);
  expect(commands).toHaveLength(0);
});
test("cross-site, wrong media type, and undeclared oversized bodies never reach storage",async()=>{
  const {commands,deps}=setup();
  expect((await handleMyReviewAction(request(edit,{origin:"https://evil.test"}),deps)).status).toBe(403);
  expect((await handleMyReviewAction(request(edit,{"content-type":"text/plain"}),deps)).status).toBe(415);
  expect((await handleMyReviewAction(request({...edit,body:"x".repeat(50*1024)}),deps)).status).toBe(413);
  expect(commands).toHaveLength(0);
});
test("sign-out, identity changes, and session-storage failures during a request block writes",async()=>{
  for(const [current,status] of [[{status:"sign_in_required"},401],[{status:"unavailable"},503],
    [{status:"authenticated",session:{...session,sessionHash:"b".repeat(64),subject:"other"}},503]] as [CustomerSessionResult,number][]){
    const {commands,deps}=setup({sessions:[signedIn,current]});expect((await handleMyReviewAction(request(edit),deps)).status).toBe(status);expect(writes(commands)).toHaveLength(0);
  }
  const renewed=setup({sessions:[signedIn,{status:"authenticated",session:{...session,revision:1}}]});expect((await handleMyReviewAction(request(edit),renewed.deps)).status).toBe(200);
  expect((await handleMyReviewAction(request(edit),{...setup().deps,backend:null})).status).toBe(503);
});
test("private paging pins the session subject and never serializes session material",async()=>{
  const {commands,deps}=setup();const response=await handleMyReviewPage(new Request("https://store.test/api/reviews/mine"),deps);
  expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store");
  const body=await response.json();expect(myReviewViewSchema(body)).not.toBeNull();expect(body.page.reviews).toEqual([mine]);
  expect(JSON.stringify(body)).not.toContain(session.sessionHash);expect(JSON.stringify(body)).not.toContain("synthetic-buyer");
  expect(commands).toEqual([{operation:"reviews.mine",subject:"synthetic-buyer",cursor:null}]);
  const cursor=encodeBuyerReviewCursor({createdAt:version,id:reviewId});
  expect((await handleMyReviewPage(new Request(`https://store.test/api/reviews/mine?cursor=${cursor}`),setup().deps)).status).toBe(200);
});
test("invalid pages and a session revoked while reading never return private review data",async()=>{
  const {commands,deps}=setup();for(const query of ["?subject=other","?cursor=bad","?cursor=bad&cursor=bad"])
    expect((await handleMyReviewPage(new Request(`https://store.test/api/reviews/mine${query}`),deps)).status).toBe(400);
  expect(commands).toHaveLength(0);
  expect((await handleMyReviewPage(new Request("https://store.test/api/reviews/mine",{headers:{"sec-fetch-site":"cross-site"}}),deps)).status).toBe(403);
  const result=await loadMyReviewPage(null,setup({sessions:[signedIn,{status:"sign_in_required"}]}).deps);expect(result).toEqual({status:"sign_in_required"});
});

test("photo selections are explicit, feature-gated and unavailable for withdrawal", async () => {
  const photoId="00000000-0000-4000-8000-000000000001";
  const {deps,commands}=setup();
  expect((await handleMyReviewAction(request({...edit,photoIds:[photoId]}),deps)).status).toBe(503);
  expect((await handleMyReviewAction(request({...edit,photoIds:[photoId,photoId]}),{...deps,photosEnabled:true})).status).toBe(400);
  expect((await handleMyReviewAction(request({...edit,photoIds:[photoId]}),{...deps,photosEnabled:true})).status).toBe(200);
  expect(writes(commands)).toEqual([expect.objectContaining({operation:"review.edit",subject:session.subject,photoIds:[photoId]})]);
  expect((await handleMyReviewAction(request({action:"withdraw",reviewId,expectedUpdatedAt:version,photoIds:[]}),deps)).status).toBe(400);
  expect((await handleMyReviewAction(request({...edit,photoIds:[]}),deps)).status).toBe(200);
  expect(writes(commands).at(-1)).toMatchObject({operation:"review.edit",photoIds:[]});
});
