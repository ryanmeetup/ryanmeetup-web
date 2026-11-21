"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { Modal, ModalActions, Text, Textarea } from "@ryanmeetup/ui";
import type { ModerationSelection } from "./useReviewModeration";
import { staffPhotoUrl } from "./ReviewModerationPhotos";

export function ReviewPhotoDecisionDialog({ selection, saving, onClose, onSubmit }: {
  selection: Extract<ModerationSelection, { photo: unknown }>; saving: boolean; onClose: () => void; onSubmit: (note: string | null) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [loaded, setLoaded] = useState(false);
  const id = useId();
  const rejecting = selection.action === "photo-reject";
  const ready = loaded && (!rejecting || Boolean(note.trim())) && !saving;
  return <Modal open setIsOpen={(open) => { if (!open && !saving) onClose(); }} closable={!saving} size="md"
    title={rejecting ? "Reject photo" : "Approve photo"} description={selection.review.item.productTitle}
    formId={id} onSubmit={(event) => { event.preventDefault(); if (ready) void onSubmit(note.trim() || null); }}
    actions={<ModalActions onCancel={onClose} pending={saving} confirmDisabled={!ready} confirmForm={id}
      confirmLabel={rejecting ? "Reject photo" : "Approve photo"} pendingLabel="Saving..." />}>
    <div className="space-y-4">
      <div className="relative aspect-[4/3]"><Image src={staffPhotoUrl(selection.review, selection.revisionId, selection.photo.id)}
        alt="Photo being moderated" fill sizes="(max-width: 639px) 90vw, 480px" unoptimized className="object-contain" onLoad={() => setLoaded(true)} onError={() => setLoaded(false)} /></div>
      <Text className="text-sm">{rejecting ? "This photo stays off the storefront. Rejecting it does not reject the review text, and the buyer sees your reason until they resubmit." : "This photo can appear only when this exact text version is published and the review is visible."}</Text>
      <Textarea id={`${id}-note`} name="note" label={rejecting ? "Reason for the buyer" : "Private note"} required={rejecting} maxLength={1000} value={note} disabled={saving}
        onChange={(event) => setNote(event.target.value)} />
      {!loaded && <Text role="status" className="text-sm">The photo must load before you can decide. Close and retry if it is unavailable.</Text>}
    </div>
  </Modal>;
}
