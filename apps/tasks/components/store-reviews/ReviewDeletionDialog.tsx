"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { FaChevronDown } from "react-icons/fa";
import { FiExternalLink } from "react-icons/fi";
import { AnimatedCollapse, DropdownSelect, Modal, ModalActions, Text, Textarea } from "@ryanmeetup/ui";
import { isReviewDeletionReason, REVIEW_DELETION_REASONS, reviewDeletionReasonLabels, storefrontProductHref } from "@/lib/store-reviews/moderation";
import type { ModerationReview, ReviewDeletionReason } from "@/lib/store-reviews/moderation";
import { ModerationVersion } from "./ReviewModerationParts";
import { ReviewPhotoStrip } from "./ReviewModerationPhotos";

const reasonOptions = REVIEW_DELETION_REASONS.map((value) => ({ value, label: reviewDeletionReasonLabels[value] }));

/** A section whose body folds away under its title, starting open. */
function Collapsible({ title, label, className, children }: { title: ReactNode; label: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return <div className={className}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">{title}</div>
      <button type="button" aria-expanded={open} aria-controls={id} aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
        onClick={() => setOpen(!open)}
        className="-my-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-current/70 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:hover:bg-white/10 dark:focus-visible:ring-white/40">
        <FaChevronDown aria-hidden className={`size-3 transition-transform duration-200 motion-reduce:transition-none ${open ? "-rotate-180" : ""}`} />
      </button>
    </div>
    <AnimatedCollapse id={id} open={open}>{children}</AnimatedCollapse>
  </div>;
}

/**
 * Permanent deletion, limited to the grounds the FTC consumer review rule
 * (16 CFR 465.7) allows. The rule text stays on screen so every deletion is
 * weighed against the same standard, whatever the rating.
 */
export function ReviewDeletionDialog({ reviews, saving, onClose, onSubmit }: {
  reviews: ModerationReview[]; saving: boolean; onClose: () => void;
  onSubmit: (note: string | null, reason: ReviewDeletionReason) => Promise<void>;
}) {
  const [reason, setReason] = useState<ReviewDeletionReason | "">("");
  const [note, setNote] = useState("");
  const [affirmed, setAffirmed] = useState(false);
  const id = useId();
  const ready = Boolean(reason) && affirmed && !saving;
  const bulk = reviews.length > 1;
  const label = bulk ? `Delete ${reviews.length} reviews` : "Delete review";
  return <Modal open setIsOpen={(open) => { if (!open && !saving) onClose(); }} closable={!saving} size="xl" panelClassName="lg:h-[44rem]" bodyClassName="lg:h-full lg:py-0"
    title={label} description={bulk ? "This permanently removes every listed review, its history, reply, and photos. It cannot be undone." : "This permanently removes the review, its history, reply, and photos. It cannot be undone."}
    formId={id}
    onSubmit={(event) => { event.preventDefault(); if (ready && reason) void onSubmit(note.trim() || null, reason); }}
    actions={<ModalActions onCancel={onClose} confirmLabel={label} confirmForm={id} pending={saving} pendingLabel="Deleting..."
      confirmDisabled={!ready} destructive
      confirmTooltip={!reason ? "Choose a reason first." : !affirmed ? "Confirm the rating played no part." : undefined} />}>
    {/* On desktop the panel has a fixed height and each column scrolls on its
        own, so the dialog body never does. The reviews come first in the DOM
        so a phone shows what is being deleted before the form. */}
    <div className="grid gap-5 lg:h-full lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]">
      {/* On desktop the list runs from the header rule to the footer rule, like
          the form column beside it, so those rules are its scroll edges. */}
      <div tabIndex={0} aria-label={bulk ? `${reviews.length} reviews being deleted` : "Review being deleted"}
        className="max-h-80 min-h-0 divide-y divide-black/10 overflow-y-auto overscroll-contain border-y border-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:focus-visible:ring-white/40 lg:col-start-2 lg:row-start-1 lg:max-h-none lg:border-y-0 lg:border-l lg:border-black/20 lg:py-2 lg:pl-6 lg:pr-1 dark:divide-white/10 dark:border-white/10 dark:lg:border-white/20">
        {reviews.map((review) => {
          const revision = review.pending ?? review.published ?? review.rejected ?? review.latest;
          return <Collapsible key={review.id} className="py-4" label={`review of ${review.item.productTitle}`}
            title={<a href={storefrontProductHref(review.item.productId)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-baseline gap-1.5 font-semibold text-black/80 underline-offset-2 wrap-anywhere hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:text-white/80 dark:focus-visible:ring-white/40">
              {review.item.productTitle}
              <FiExternalLink aria-hidden className="size-3 shrink-0 self-center opacity-70" />
              <span className="sr-only">(opens the product page in a new tab)</span>
            </a>}>
            <div className="pt-3">
              <ModerationVersion revision={revision} label="Review being deleted" showLabel={false}>
                <ReviewPhotoStrip review={review} revision={revision} />
              </ModerationVersion>
            </div>
          </Collapsible>;
        })}
      </div>
      <div className="min-h-0 space-y-5 lg:col-start-1 lg:row-start-1 lg:overflow-y-auto lg:overscroll-contain lg:py-6 lg:pr-1">
        <section aria-labelledby={`${id}-ftc`} className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-950 dark:border-amber-300/30 dark:bg-amber-950/40 dark:text-amber-50">
          <Collapsible label="FTC rules" title={<p id={`${id}-ftc`} className="font-semibold">FTC rules on removing reviews</p>}>
            <div className="space-y-3 pt-3">
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
            </div>
          </Collapsible>
        </section>
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
            {bulk ? "I'm deleting every listed review for the reason above. Their ratings, and whether they are positive or negative, played no part."
              : "I'm deleting this for the reason above. Its rating, and whether it is positive or negative, played no part."}
            <span aria-hidden className="ml-0.5 text-red-600 dark:text-red-400">*</span>
          </span>
        </label>
      </div>
    </div>
  </Modal>;
}
