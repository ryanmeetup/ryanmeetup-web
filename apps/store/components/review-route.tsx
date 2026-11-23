"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Heading, Text } from "@ryanmeetup/ui";
import { trackStoreEvent } from "@/lib/analytics";
import { submitCustomReview } from "@/lib/custom-review-client";
import type { CustomReviewAccess } from "@/lib/custom-review-access";
import { CustomReviewComposer } from "./custom-review-composer";

/**
 * Leave a review route. A buyer who came from inside the store goes back
 * through history, landing where they were; one who opened the route directly
 * has nothing to go back to and goes to `fallback` instead.
 */
export function useLeaveReviewRoute(fallback: string) {
  const router = useRouter();
  return () => {
    const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const landedHere = !entry || new URL(entry.name).pathname === window.location.pathname;
    if (landedHere) router.push(fallback);
    else router.back();
  };
}

/** What a review route shows once the review is in: the form's job is done, so it gives way to the way back. */
export function ReviewRouteDone({ title, message, children }: { title: string; message: string; children: ReactNode }) {
  const confirmation = useRef<HTMLDivElement>(null);
  // The form that held focus is gone; start the reader at the confirmation.
  useEffect(() => confirmation.current?.focus(), []);
  return (
    <div className="w-full max-w-3xl space-y-6">
      <div ref={confirmation} tabIndex={-1} className="space-y-2 focus:outline-none">
        <Heading size="h1" className="text-4xl sm:text-5xl">{title}</Heading>
        <Text>{message}</Text>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">{children}</div>
    </div>
  );
}

/** `/products/[handle]/review`: the product page's review form, as the phone-sized page it opens. */
export function WriteReviewRoute({ access, product, productId, backHref, backLabel, initialLineId }: {
  access: CustomReviewAccess;
  product: Parameters<typeof CustomReviewComposer>[0]["product"];
  productId: string;
  backHref: string;
  backLabel: string;
  initialLineId?: string;
}) {
  const leave = useLeaveReviewRoute(backHref);
  const [message, setMessage] = useState("");
  if (message) {
    return (
      <ReviewRouteDone title="Review received" message={message}>
        <Button.Link href={backHref} size="md" className="w-full sm:w-auto">{backLabel}</Button.Link>
        {backHref !== "/reviews/mine" && <Button.Link href="/reviews/mine" variant="secondary" size="md" className="w-full sm:w-auto">My reviews</Button.Link>}
      </ReviewRouteDone>
    );
  }
  return (
    <CustomReviewComposer
      presentation="page"
      open
      access={access}
      product={product}
      initialLineId={initialLineId}
      photos={access.status === "ready" ? access.photos : undefined}
      onClose={leave}
      onSubmit={async (review) => {
        const result = await submitCustomReview({ ...review, productId });
        trackStoreEvent("review_submitted", { outcome: result.ok ? "success" : "error" });
        if (result.ok) setMessage(result.message);
        return result;
      }}
    />
  );
}
