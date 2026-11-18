"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  REVIEW_BODY_MAX,
  REVIEW_NAME_STYLES,
  REVIEW_TITLE_MAX,
  reviewDisplayName,
  reviewSubmissionSchema,
  type ReviewNameStyle,
  type ReviewSubmission,
} from "@ryanmeetup/reviews";
import { Button, DropdownSelect, ErrorCallout, Input, Modal, ModalActions, StarRating, Text, Textarea } from "@ryanmeetup/ui";
import type { CustomReviewAccess } from "@/lib/custom-review-access";
import { reviewSignInRel } from "@/lib/review-sign-in";
import type { Product } from "@/lib/types";

export type CustomReviewResult = { ok: true; message: string } | { ok: false; error: string };

/** Editing an existing review: start from what the buyer wrote, and offer only names the server can build. */
export type CustomReviewEdit = {
  initial: { rating: number; title: string | null; body: string; nameStyle: ReviewNameStyle };
  nameChoices: { style: ReviewNameStyle; displayName: string }[];
};

const NAME_STYLE_LABELS: Record<ReviewNameStyle, string> = {
  full: "Full name",
  "first-initial": "First name and last initial",
  anonymous: "Anonymous",
};

/** What each state says when there's no form to show. */
const CLOSED_COPY: Record<Exclude<CustomReviewAccess["status"], "ready">, { title: string; body: string }> = {
  unavailable: { title: "Reviews are closed for now", body: "Review collection is temporarily unavailable. Please try again later." },
  "signed-out": { title: "Sign in to review", body: "Reviews come from verified purchases. Sign in with the email you ordered with, and we'll bring you right back here." },
  "no-purchase": { title: "No purchase to review yet", body: "We couldn't find an order for this product on your account. Reviews open once your order has shipped." },
  reviewed: { title: "You've already reviewed this", body: "Thanks for weighing in. Each purchase gets one review; edit or withdraw yours from My reviews." },
};

type Draft = { lineId: string; rating: number | null; title: string; body: string; nameStyle: ReviewNameStyle };

/**
 * The buyer's review form for custom reviews. It renders every access state,
 * and in the ready state checks the review against the shared contract before
 * handing it to `onSubmit`.
 */
export function CustomReviewComposer({
  access,
  product,
  open,
  onClose,
  onSubmit,
  edit,
}: {
  access: CustomReviewAccess;
  product: Pick<Product, "title"> & { featuredImage: Product["featuredImage"] | null };
  open: boolean;
  onClose: () => void;
  onSubmit: (review: ReviewSubmission & { lineId: string }) => Promise<CustomReviewResult>;
  edit?: CustomReviewEdit;
}) {
  const formId = useId();
  const ratingField = useRef<HTMLDivElement>(null);
  const ready = access.status === "ready" ? access : null;
  const freshDraft = (): Draft => ({
    lineId: ready?.purchases.length === 1 ? ready.purchases[0].lineId : "",
    rating: edit?.initial.rating ?? null,
    title: edit?.initial.title ?? "",
    body: edit?.initial.body ?? "",
    nameStyle: edit?.initial.nameStyle ?? ready?.defaultNameStyle ?? "first-initial",
  });
  const [draft, setDraft] = useState<Draft>(freshDraft);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const nameChoices = edit?.nameChoices ?? (ready ? REVIEW_NAME_STYLES.map((style) => ({ style, displayName: reviewDisplayName(style, ready.buyer) })) : []);
  const publicName = nameChoices.find((choice) => choice.style === draft.nameStyle)?.displayName ?? "";

  function close() {
    if (pending) return;
    setError("");
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || pending) return;
    if (!draft.lineId) return setError("Choose which purchase you're reviewing.");
    if (!draft.rating) {
      setError("Choose a rating before submitting your review.");
      ratingField.current?.querySelector("input")?.focus();
      return;
    }
    const review = reviewSubmissionSchema({ rating: draft.rating, title: draft.title || null, body: draft.body, nameStyle: draft.nameStyle });
    if (!review) return setError(`Write your review in ${REVIEW_BODY_MAX.toLocaleString("en-US")} characters or fewer, and keep any title under ${REVIEW_TITLE_MAX}.`);
    setPending(true);
    setError("");
    try {
      const result = await onSubmit({ ...review, lineId: draft.lineId });
      if (!result.ok) return setError(result.error);
      if (!edit) setDraft(freshDraft());
      onClose();
    } catch {
      setError("Your review could not be submitted. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const productCard = (
    <div className="flex items-center gap-4 rounded-xl border border-black/10 p-3 dark:border-white/10">
      {product.featuredImage && <Image src={product.featuredImage.url} alt="" width={64} height={64} sizes="64px" className="h-16 w-16 shrink-0 rounded-lg object-cover" />}
      <Text className="min-w-0 wrap-anywhere font-semibold">{product.title}</Text>
    </div>
  );

  if (!ready) {
    const copy = CLOSED_COPY[access.status as keyof typeof CLOSED_COPY];
    return (
      <Modal
        open={open}
        setIsOpen={(next) => !next && close()}
        title={copy.title}
        size="md"
        bodyClassName="space-y-5"
        actions={
          access.status === "reviewed" ? (
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
              <Button type="button" variant="secondary" size="md" className="w-full sm:w-auto" onClick={close}>Close</Button>
              <Button.Link href="/reviews/mine" size="md" className="w-full sm:w-auto">My reviews</Button.Link>
            </div>
          ) : access.status === "signed-out" ? (
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
              <Button type="button" variant="secondary" size="md" className="w-full sm:w-auto" onClick={close}>Not now</Button>
              <Button.Link href={access.signInUrl} rel={reviewSignInRel} prefetch={false} size="md" className="w-full sm:w-auto">Sign in</Button.Link>
            </div>
          ) : (
            <ModalActions confirmLabel="Close" onConfirm={close} />
          )
        }
      >
        {productCard}
        <Text>{copy.body}</Text>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      setIsOpen={(next) => !next && close()}
      title={edit ? "Edit your review" : "Write a review"}
      size="lg"
      description={edit ? "Changes are checked before they go up. Until then, your current review stays as it is." : "Tell other Ryans how it went."}
      closable={!pending}
      formId={formId}
      onSubmit={submit}
      bodyClassName="space-y-5"
      panelClassName="max-sm:fixed max-sm:inset-0 max-sm:m-0 max-sm:h-dvh max-sm:!max-h-dvh max-sm:rounded-none max-sm:pt-[env(safe-area-inset-top)] max-sm:pb-[env(safe-area-inset-bottom)]"
      actions={<ModalActions onCancel={close} confirmForm={formId} confirmLabel={edit ? "Save changes" : "Submit review"} pending={pending} pendingLabel={edit ? "Saving" : "Submitting"} />}
    >
      {productCard}
      <fieldset disabled={pending} aria-busy={pending} className="min-w-0 space-y-5">
        <legend className="sr-only">Your review</legend>
        {ready.purchases.length > 1 ? (
          <DropdownSelect
            label="Purchase"
            variant="field"
            required
            value={draft.lineId}
            disabled={pending}
            onChange={(lineId) => setDraft((value) => ({ ...value, lineId }))}
            options={[{ value: "", label: "Choose a purchase" }, ...ready.purchases.map((purchase) => ({ value: purchase.lineId, label: purchase.label }))]}
          />
        ) : (
          <Text className="text-sm wrap-anywhere">Reviewing <span className="font-semibold">{ready.purchases[0]?.label}</span></Text>
        )}
        <div ref={ratingField} onInvalid={() => setError("Choose a rating before submitting your review.")}>
          <StarRating label="Rating" name={`${formId}-rating`} step={1} required disabled={pending} value={draft.rating} onChange={(rating) => setDraft((value) => ({ ...value, rating }))} />
        </div>
        <Input label="Title" name={`${formId}-title`} maxLength={REVIEW_TITLE_MAX} placeholder="Sum it up, Ryan" value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} />
        <Textarea id={`${formId}-body`} label="Review" name="body" required maxLength={REVIEW_BODY_MAX} placeholder="The good, the bad, the very Ryan. How's it fitting, and how's it holding up?" value={draft.body} onChange={(event) => setDraft((value) => ({ ...value, body: event.target.value }))} />
        <div className="space-y-2">
          <DropdownSelect
            label="Show my name as"
            variant="field"
            required
            value={draft.nameStyle}
            disabled={pending}
            onChange={(nameStyle) => setDraft((value) => ({ ...value, nameStyle: nameStyle as ReviewNameStyle }))}
            options={nameChoices.map(({ style, displayName }) => ({ value: style, label: `${NAME_STYLE_LABELS[style]}: ${displayName}` }))}
          />
          <Text className="text-sm" aria-live="polite">Shown publicly as <span className="font-semibold">{publicName}</span></Text>
        </div>
        <Text className="text-sm">We check every review before it goes up. Your order details and email stay private.</Text>
      </fieldset>
      {error && <ErrorCallout>{error}</ErrorCallout>}
    </Modal>
  );
}
