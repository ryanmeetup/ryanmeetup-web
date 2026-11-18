"use client";

import { useId, useState } from "react";
import { REVIEW_REPLY_MAX, reviewReplyBodySchema } from "@ryanmeetup/reviews";
import { Button, ErrorCallout, Modal, ModalActions, Text, Textarea } from "@ryanmeetup/ui";
import type { ModerationReview } from "@/lib/store-reviews/moderation";

export function ReviewReplyDialog({ review, remove, saving, onClose, onSubmit }: {
  review: ModerationReview; remove: boolean; saving: boolean;
  onClose: () => void; onSubmit: (body: string | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(review.reply?.body ?? "");
  const [confirmedBody, setConfirmedBody] = useState<string | null>(null);
  const id = useId();
  const body = reviewReplyBodySchema(draft);
  const confirming = remove || confirmedBody !== null;
  const label = remove ? "Remove reply" : review.reply ? "Update reply" : "Publish reply";
  const unavailable = !body || body === review.reply?.body;
  return <Modal open closable={!saving} setIsOpen={(open) => { if (!open && !saving) onClose(); }}
    title={confirming ? label : review.reply ? "Edit reply" : "Write reply"}
    description={remove ? "Remove this official reply from the storefront. Its audit history is kept."
      : confirming ? "Confirm the exact official reply shown below." : "Write the public reply that will appear with the approved review."}
    formId={id} onSubmit={(event) => {
      event.preventDefault(); if (saving) return;
      if (remove) void onSubmit(null);
      else if (confirmedBody !== null) void onSubmit(confirmedBody);
      else if (body && !unavailable) setConfirmedBody(body);
    }}
    actions={<ModalActions onCancel={onClose} confirmForm={id} pending={saving} destructive={remove}
      confirmLabel={confirming ? label : "Review reply"} confirmDisabled={saving || (!confirming && unavailable)} />}
    supportingActions={!remove && confirming && <Button variant="ghost" disabled={saving} onClick={() => setConfirmedBody(null)}>Back to edit</Button>}>
    <div className="space-y-4">
      <Text className="font-semibold wrap-anywhere">{review.item.productTitle}</Text>
      {review.state === "hidden" && <Text className="text-sm">The review stays hidden. Its reply appears only after the review is restored.</Text>}
      {confirming ? <section aria-label={remove ? "Reply being removed" : "Reply preview"} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <Text className="whitespace-pre-wrap text-sm wrap-anywhere">{remove ? review.reply?.body : confirmedBody}</Text>
      </section> : <>
        <Textarea id={`${id}-body`} name="body" label="Official reply" required rows={5} autoFocus
          value={draft} disabled={saving} onChange={(event) => setDraft(event.target.value)} aria-describedby={`${id}-hint`} />
        <Text id={`${id}-hint`} className="text-xs">Public text. Up to {REVIEW_REPLY_MAX.toLocaleString("en-US")} characters.</Text>
        {draft.trim() && !body && <ErrorCallout>Enter a reply of up to {REVIEW_REPLY_MAX.toLocaleString("en-US")} characters.</ErrorCallout>}
      </>}
    </div>
  </Modal>;
}
