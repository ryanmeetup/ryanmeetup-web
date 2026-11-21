"use client";

import { useId, useState } from "react";
import { DropdownSelect, Modal, ModalActions, Text, Textarea } from "@ryanmeetup/ui";
import { isReviewDeletionReason, REVIEW_DELETION_REASONS, reviewDeletionReasonLabels } from "@/lib/store-reviews/moderation";
import type { ModerationReview, ReviewDeletionReason } from "@/lib/store-reviews/moderation";
import { ModerationVersion } from "./ReviewModerationParts";

const reasonOptions = REVIEW_DELETION_REASONS.map((value) => ({ value, label: reviewDeletionReasonLabels[value] }));

/**
 * Permanent deletion, limited to the grounds the FTC consumer review rule
 * (16 CFR 465.7) allows. The rule text stays on screen so every deletion is
 * weighed against the same standard, whatever the rating.
 */
export function ReviewDeletionDialog({ review, saving, onClose, onSubmit }: {
  review: ModerationReview; saving: boolean; onClose: () => void;
  onSubmit: (note: string | null, reason: ReviewDeletionReason) => Promise<void>;
}) {
  const [reason, setReason] = useState<ReviewDeletionReason | "">("");
  const [note, setNote] = useState("");
  const [affirmed, setAffirmed] = useState(false);
  const id = useId();
  const ready = Boolean(reason) && affirmed && !saving;
  const revision = review.pending ?? review.published ?? review.rejected ?? review.latest;
  return <Modal open setIsOpen={(open) => { if (!open && !saving) onClose(); }} closable={!saving} size="lg"
    title="Delete review" description="This permanently removes the review, its history, reply, and photos. It cannot be undone."
    formId={id}
    onSubmit={(event) => { event.preventDefault(); if (ready && reason) void onSubmit(note.trim() || null, reason); }}
    actions={<ModalActions onCancel={onClose} confirmLabel="Delete review" confirmForm={id} pending={saving} pendingLabel="Deleting..."
      confirmDisabled={!ready} destructive
      confirmTooltip={!reason ? "Choose a reason first." : !affirmed ? "Confirm the rating played no part." : undefined} />}>
    <div className="space-y-5">
      <section aria-labelledby={`${id}-ftc`} className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-950 dark:border-amber-300/30 dark:bg-amber-950/40 dark:text-amber-50">
        <p id={`${id}-ftc`} className="font-semibold">FTC rules on removing reviews</p>
        <p>
          The FTC&apos;s consumer review rule (16 CFR 465.7) bars removing or hiding reviews because they are negative or
          low-rated. Deleting is allowed only for the reasons below, applied the same way to every review, whatever its stars.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Spam, fake, or clearly false or misleading</li>
          <li>Wholly unrelated to the product</li>
          <li>Trade secrets or private or confidential information</li>
          <li>Defamatory, harassing, abusive, obscene, vulgar, or sexually explicit</li>
          <li>Demeaning about race, gender, sexuality, ethnicity, or another intrinsic characteristic</li>
        </ul>
        <p>Not allowed: a low rating, criticism, or complaints about shipping or quality. Reply instead. Violations can bring civil penalties. This is guidance, not legal advice.</p>
      </section>
      <Text className="font-semibold wrap-anywhere">{review.item.productTitle}</Text>
      <ModerationVersion revision={revision} label="Review being deleted" />
      <DropdownSelect label="Reason" variant="field" required value={reason} disabled={saving}
        options={[{ value: "", label: "Choose a reason" }, ...reasonOptions]}
        onChange={(value) => setReason(isReviewDeletionReason(value) ? value : "")} />
      <div className="space-y-2">
        <Textarea id={`${id}-note`} name="note" label="Private note" rows={3} maxLength={1000} value={note} disabled={saving}
          placeholder="What made this spam? A link, a bot pattern, a copy of another review..."
          onChange={(event) => setNote(event.target.value)} aria-describedby={`${id}-note-hint`} />
        <Text id={`${id}-note-hint`} className="text-xs">Kept in the deletion log with the reason, rating, and your name. The review text is not kept.</Text>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-black/10 p-4 text-sm dark:border-white/10">
        <input type="checkbox" required checked={affirmed} disabled={saving} onChange={(event) => setAffirmed(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/30 accent-black dark:border-white/30 dark:accent-white" />
        <span>
          I&apos;m deleting this for the reason above. Its rating, and whether it is positive or negative, played no part.
          <span aria-hidden className="ml-0.5 text-red-600 dark:text-red-400">*</span>
        </span>
      </label>
    </div>
  </Modal>;
}
