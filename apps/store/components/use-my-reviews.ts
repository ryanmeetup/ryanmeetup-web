"use client";

import { useRef, useState } from "react";
import type { BuyerReview, ReviewSubmission } from "@ryanmeetup/reviews";
import { changeMyReview, fetchMyReviews, MyReviewRequestError } from "@/lib/my-reviews-client";
import type { MyReviewView } from "@/lib/my-review-view";

export function useMyReviews(initial: MyReviewView | null) {
  const [view,setView] = useState(initial);
  const [editing,setEditing] = useState<BuyerReview | null>(null);
  const [withdrawing,setWithdrawing] = useState<BuyerReview | null>(null);
  const [pending,setPending] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState(initial ? "" : "Your reviews could not load. Refresh to try again.");
  const active = useRef(false);

  async function load(more = false) {
    if (active.current || editing || withdrawing) return;
    active.current=true;setPending(true);setError("");setMessage("");
    try {
      let next=await fetchMyReviews(more ? view?.page.nextCursor : null);
      const append=more && view && next.viewerKey === view.viewerKey;
      if (more && view && !append) next=await fetchMyReviews();
      setView(append ? {...next,page:{...next.page,reviews:[...view.page.reviews,...next.page.reviews.filter((r)=>!view.page.reviews.some((old)=>old.id===r.id))]}} : next);
    } catch (failure) { setView(null);setError(failure instanceof MyReviewRequestError ? failure.message : "Your reviews could not load. Refresh to try again."); }
    finally {active.current=false;setPending(false);}
  }
  /** Reload after a change made elsewhere on the page, then say what happened. */
  async function reloadWith(notice:string) {await load();setMessage(notice);}
  function select(review:BuyerReview, action:"edit"|"withdraw") {
    if (active.current || !view || review.status === "withdrawn" || (action === "edit" && review.status === "hidden")) return;
    setMessage("");setError(""); if(action === "edit")setEditing(review);else setWithdrawing(review);
  }
  function dismiss() {if(!active.current){setEditing(null);setWithdrawing(null);}}

  async function save(review:BuyerReview, submission?:ReviewSubmission & {photoIds?:string[];viewerKey?:string}) {
    if(active.current) return {ok:false as const,error:"A review change is already in progress."};
    active.current=true;setPending(true);setError("");setMessage("");
    let outcome:"saved"|"conflict"|"unknown"="unknown";
    try {
      await changeMyReview(submission ? {action:"edit",reviewId:review.id,expectedUpdatedAt:review.updatedAt,...submission} :
        {action:"withdraw",reviewId:review.id,expectedUpdatedAt:review.updatedAt});
      outcome="saved";
    } catch(failure) {if(failure instanceof MyReviewRequestError && failure.status===409)outcome="conflict";}
    setEditing(null);setWithdrawing(null);
    if(outcome==="unknown") {setView(null);setError("We could not confirm this change. Refresh your reviews before trying again.");}
    else {
      if(outcome==="saved")setMessage(submission ? "Saved. Your changes are waiting for approval." : "Withdrawn. It is no longer on the product page or in rating totals.");
      try {setView(await fetchMyReviews());if(outcome==="conflict")setError("This review changed. Your reviews have been refreshed; check the latest text before deciding again.");}
      catch {setView(null);setError(outcome==="saved" ? "Your change was saved, but reviews could not reload. Refresh before making another change." : "Your review changed and could not reload. Refresh before making another change.");}
    }
    active.current=false;setPending(false);
    return outcome==="saved" ? {ok:true as const,message:""} : {ok:false as const,error:"Refresh your reviews before trying again."};
  }
  return {view,editing,withdrawing,pending,message,error,load,reloadWith,select,dismiss,save};
}
