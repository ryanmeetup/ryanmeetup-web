import { expect, test } from "@playwright/test";
import { reviewViewerKey } from "../lib/review-viewer";
import { submitCustomReview } from "../lib/custom-review-submission";
import { handleMyReviewAction, loadMyReviewPage } from "../lib/my-review-actions";
import { handleReviewPhoto } from "../lib/review-photo-actions";
import { handleReviewPhotoRead } from "../lib/review-photo-reads";
import type { CustomerAccountSession } from "../lib/customer-account/storage";
import type { CustomerSessionResult } from "../lib/customer-account/session";
import type { ReviewBackend } from "../lib/review-backend";

const session={sessionHash:"a".repeat(64),subject:"private-buyer",createdAt:1,expiresAt:2,revision:0} as CustomerAccountSession;
const authenticated:CustomerSessionResult={status:"authenticated",session};
const viewer=reviewViewerKey(session);
const id="00000000-0000-4000-8000-000000000001";
const version="2026-11-20T00:00:00.123456Z";
const submission={rating:5,title:"Title",body:"Body",nameStyle:"anonymous"};
const request=(url:string,body?:object,method="POST",marker="b".repeat(64))=>new Request(`https://store.test${url}`,{method,
  headers:{origin:"https://store.test","content-type":"application/json","x-review-viewer":marker},...(body?{body:JSON.stringify(body)}:{})});

test("the context endpoint returns only an equality marker and checks it against the current session",async()=>{
  const reader={selection:async()=>null,preview:async()=>null};const services={enabled:true,reader,loadSession:async()=>authenticated};
  const response=await handleReviewPhotoRead(request("/api/reviews/photos/context",undefined,"GET",viewer),"context",services);
  expect(response.status).toBe(200);expect(await response.json()).toEqual({viewerKey:viewer});expect(viewer).not.toBe(session.sessionHash);
  const stale=await handleReviewPhotoRead(request("/api/reviews/photos/context",undefined,"GET"),"context",services);
  expect(stale.status).toBe(409);expect((await stale.json()).code).toBe("viewer_changed");
  expect((await handleReviewPhotoRead(request("/api/reviews/photos/context?subject=other",undefined,"GET",viewer),"context",services)).status).toBe(400);
});

test("an old viewer marker cannot submit, edit, upload, discard or read another account's photos",async()=>{
  let operations=0;
  const backend=(async()=>{operations++;throw new Error("Must not run");}) as ReviewBackend;
  const loadSession=async()=>authenticated;
  const common={loadSession,findBuyerName:async()=>({firstName:"Ryan",lastName:null}),backend};
  expect((await submitCustomReview(request("/api/reviews",{...submission,productId:"100",lineId:null}),{...common,
    findPurchases:async()=>{operations++;return {status:"none" as const,reason:"not_purchased" as const};},findProductTitle:async()=>"Shirt"})).status).toBe(409);
  expect((await handleMyReviewAction(request("/api/reviews/mine",{...submission,action:"edit",reviewId:id,expectedUpdatedAt:version}),common)).status).toBe(409);
  const staging={consumeUploadBudget:async()=>{operations++;return {allowed:true,retryAfter:0};},stage:async()=>({status:"full" as const}),getReady:async()=>null,discard:async()=>{operations++;return true;}};
  const upload=request(`/api/reviews/photos?productId=100&requestKey=${id}`);upload.headers.set("content-type","image/png");
  const photoServices={enabled:true,loadSession,staging,findPurchases:async()=>({status:"none" as const,reason:"not_purchased" as const}),findProductTitle:async()=>"Shirt"};
  expect((await handleReviewPhoto(upload,photoServices)).status).toBe(409);
  expect((await handleReviewPhoto(request(`/api/reviews/photos?productId=100&photoId=${id}`,undefined,"DELETE"),photoServices)).status).toBe(409);
  expect((await handleReviewPhotoRead(request(`/api/reviews/photos?productId=100&photoId=${id}`,undefined,"GET"),"preview",{enabled:true,loadSession,
    reader:{selection:async()=>{operations++;return null;},preview:async()=>{operations++;return null;}}})).status).toBe(409);
  expect(operations).toBe(0);
});

test("photo UI capability is explicit in private buyer reads and absent by default",async()=>{
  const backend=(async()=>({reviews:[],nextCursor:null})) as ReviewBackend;
  const deps={loadSession:async()=>authenticated,findBuyerName:async()=>null,backend};
  const closed=await loadMyReviewPage(null,deps);expect(closed.status==="ready"&&closed.view.photosEnabled).toBeUndefined();
  const enabled=await loadMyReviewPage(null,{...deps,photosEnabled:true});expect(enabled.status==="ready"&&enabled.view.photosEnabled).toBe(true);
});
