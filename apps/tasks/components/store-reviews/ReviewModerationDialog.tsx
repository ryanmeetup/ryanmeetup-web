"use client";

import { useId, useState } from "react";
import { Modal, ModalActions, Text, Textarea } from "@ryanmeetup/ui";
import { moderationActionLabel, moderationReasonRequired } from "@/lib/store-reviews/moderation";
import type { ModerationAction, ModerationReview } from "@/lib/store-reviews/moderation";
import { ModerationVersion } from "./ReviewModerationCard";

export function ReviewModerationDialog({ selection, saving, onClose, onSubmit }: {
  selection: { action: ModerationAction; review: ModerationReview }; saving: boolean; onClose: () => void; onSubmit: (note: string | null) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const id = useId();
  const { review, action } = selection;
  const required = moderationReasonRequired(action);
  const label = moderationActionLabel(action, review);
  const descriptions = {
    approve: review.state === "hidden" ? "Approve this revision. The review stays hidden until you restore it." : "Publish this exact revision and include its rating in storefront totals.",
    reject: review.published ? "Reject this waiting edit. The approved version stays public unless the review is hidden." : "Keep this submission off the storefront and out of rating totals.",
    hide: "Remove this review from the storefront and rating totals. Its history is kept.",
    republish: review.published
      ? "Publish this rejected edit in place of the current public version. Its rating replaces the old one in storefront totals."
      : "Publish this rejected review after all and include its rating in storefront totals.",
    restore: review.published ? "Return the approved version to the storefront and rating totals. Any waiting edit still needs approval." : "Remove the staff hold. This review still needs approval before it appears on the storefront.",
  };
  return <Modal open setIsOpen={(open) => { if (!open && !saving) onClose(); }} closable={!saving}
    title={label} description={descriptions[action]} formId={id}
    onSubmit={(event) => { event.preventDefault(); if (!saving && (!required || note.trim())) void onSubmit(note.trim() || null); }}
    actions={<ModalActions onCancel={onClose} confirmLabel={label} confirmForm={id} pending={saving}
      confirmDisabled={saving || (required && !note.trim())} destructive={required} />}>
    <div className="space-y-4">
      <Text className="font-semibold wrap-anywhere">{review.item.productTitle}</Text>
      <ModerationVersion revision={(action === "approve" || action === "reject" ? review.pending :
        action === "republish" ? review.rejected : review.published) ?? review.latest} label="Revision being reviewed" />
      <Textarea id={`${id}-reason`} name="note" label="Private reason" required={required} rows={3} autoFocus
        maxLength={1000} value={note} disabled={saving} onChange={(event) => setNote(event.target.value)}
        aria-describedby={`${id}-reason-hint`} />
      <Text id={`${id}-reason-hint`} className="text-xs">Visible only to staff. Up to 1,000 characters.</Text>
    </div>
  </Modal>;
}
