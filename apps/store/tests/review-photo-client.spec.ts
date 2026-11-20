import { expect, test } from "@playwright/test";
import { checkReviewPhotoViewer, discardReviewPhoto, fetchReviewPhotoBlob, fetchReviewPhotoSelection, ReviewPhotoClientError, uploadReviewPhoto } from "../lib/review-photo-client";
const original=globalThis.fetch;
const viewer="a".repeat(64);const id="00000000-0000-4000-8000-000000000001";
const scope={viewerKey:viewer,productId:"100",review:{id,updatedAt:"2026-11-20T00:00:00.123456Z"}};
const signal=()=>new AbortController().signal;
test.afterEach(()=>{globalThis.fetch=original;});

test("uploads raw bytes under a stable key, with a viewer marker outside the body",async()=>{
  const file=new File(["synthetic image"],"shirt.png",{type:"image/png"});
  globalThis.fetch=async(input,init)=>{
    expect(String(input)).toContain(`requestKey=${id}`);expect(init?.body).toBe(file);
    expect(new Headers(init?.headers).get("x-review-viewer")).toBe(viewer);
    return Response.json({status:"ready",photo:{id,width:48,height:32,expiresAt:new Date(Date.now()+3600000).toISOString()}},{headers:{"X-Review-Viewer":viewer}});
  };
  expect((await uploadReviewPhoto(scope,file,id,signal())).id).toBe(id);
});

test("selection uses the exact text version and rejects another viewer or version",async()=>{
  let version=scope.review.updatedAt;let marker=viewer;
  globalThis.fetch=async()=>Response.json({selection:{reviewId:id,productId:"100",updatedAt:version,photos:[{id,width:48,height:32}]}},{headers:{"X-Review-Viewer":marker}});
  expect(await fetchReviewPhotoSelection(scope,signal())).toHaveLength(1);
  version="2026-11-20T00:00:01.123456Z";await expect(fetchReviewPhotoSelection(scope,signal())).rejects.toMatchObject({refreshRequired:true});
  marker="b".repeat(64);await expect(fetchReviewPhotoSelection(scope,signal())).rejects.toMatchObject({refreshRequired:true});
});

test("preview accepts only a bounded private WebP from the same viewer",async()=>{
  globalThis.fetch=async()=>new Response("normalized bytes",{headers:{"content-type":"image/webp","x-review-viewer":viewer}});
  expect((await fetchReviewPhotoBlob(scope,id,signal())).type).toBe("image/webp");
  globalThis.fetch=async()=>new Response("<svg/>",{headers:{"content-type":"image/svg+xml","x-review-viewer":viewer}});
  await expect(fetchReviewPhotoBlob(scope,id,signal())).rejects.toBeInstanceOf(ReviewPhotoClientError);
});

test("account changes are fatal while ordinary upload failures permit explicit retry",async()=>{
  globalThis.fetch=async()=>Response.json({code:"viewer_changed",error:"Your account changed."},{status:409});
  await expect(checkReviewPhotoViewer(scope,signal())).rejects.toMatchObject({refreshRequired:true});
  globalThis.fetch=async()=>Response.json({error:"Try again."},{status:503});
  await expect(uploadReviewPhoto(scope,new File(["bytes"],"shirt.png",{type:"image/png"}),id,signal())).rejects.toMatchObject({refreshRequired:false});
});

test("discard treats unavailable drafts as removed but refuses a changed account",async()=>{
  globalThis.fetch=async()=>new Response(null,{status:404});await expect(discardReviewPhoto(scope,id,signal())).resolves.toBeUndefined();
  globalThis.fetch=async()=>Response.json({code:"viewer_changed",error:"Changed"},{status:409});
  await expect(discardReviewPhoto(scope,id,signal())).rejects.toMatchObject({refreshRequired:true});
});
