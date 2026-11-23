"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import type { FormEvent, FormEventHandler, ReactNode } from "react";
import {
  REVIEW_BODY_MAX,
  REVIEW_NAME_STYLES,
  REVIEW_TITLE_MAX,
  reviewDisplayName,
  reviewSubmissionSchema,
  type ReviewNameStyle,
  type ReviewSubmission,
} from "@ryanmeetup/reviews";
import { Button, Card, DropdownSelect, ErrorCallout, footerActionGroup, Heading, Input, Modal, ModalActions, StarRating, Text, Textarea } from "@ryanmeetup/ui";
import type { CustomReviewAccess, ReviewablePurchase } from "@/lib/custom-review-access";
import { variantOptions } from "@/lib/review-suggestions";
import { reviewSignInRel, signInExplanation } from "@/lib/review-sign-in";
import type { Product } from "@/lib/types";
import type { ReviewPhotoEditorScope } from "@/lib/review-photo-client";
import { ReviewItemDetails, variantRows } from "./review-item";
import { useReviewPhotos } from "./use-review-photos";
import { ReviewPhotoField } from "./review-photo-field";

export type CustomReviewResult = { ok: true; message: string } | { ok: false; error: string; refreshRequired?: boolean };
export type CustomReviewSubmission = ReviewSubmission & { lineId: string | null; photoIds?: string[]; viewerKey?: string };

/** Editing an existing review: start from what the buyer wrote, and offer only names the server can build. */
export type CustomReviewEdit = {
  initial: { rating: number; title: string; body: string; nameStyle: ReviewNameStyle };
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
  "signed-out": { title: "Sign in to review", body: "We'll send you to Shopify to sign in with your email, then right back here. Already signed in to Shopify on this device? You'll come straight back as that account. Use the email you ordered with, and your review gets a Verified badge." },
  reviewed: { title: "You've already reviewed this", body: "Thanks for weighing in. Edit or withdraw your review from My reviews." },
};

type Draft = { lineId: string; rating: number | null; title: string; body: string; nameStyle: ReviewNameStyle };

/**
 * `modal` is a dialog over the page that opened it. `page` is the dedicated
 * review route a phone gets instead: the title is the page's heading, and the
 * form and its actions scroll with the document rather than inside a capped
 * card, so the fields keep the screen while the buyer writes.
 */
export type CustomReviewPresentation = "modal" | "page";

/** The review route's layout: a page heading over the form card, actions last. */
function ReviewPage({ title, description, wide, formId, onSubmit, actions, supportingActions, children }: {
  title: ReactNode; description?: ReactNode; wide?: boolean; formId?: string; onSubmit?: FormEventHandler<HTMLFormElement>;
  actions: ReactNode; supportingActions?: ReactNode; children: ReactNode;
}) {
  const content = <>
    <div className="space-y-2">
      <Heading size="h1" className="text-4xl sm:text-5xl">{title}</Heading>
      {description && <Text>{description}</Text>}
    </div>
    <Card size="lg">
      <div className="space-y-5">{children}</div>
      <div className="mt-6 flex flex-col gap-3 border-t border-black/10 pt-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
        {supportingActions && <div className="flex flex-wrap items-center gap-2">{supportingActions}</div>}
        <div className={`${footerActionGroup} flex-col-reverse sm:ml-auto sm:justify-end`}>{actions}</div>
      </div>
    </Card>
  </>;
  const className = `w-full min-w-0 space-y-6 ${wide ? "max-w-5xl" : "max-w-3xl"}`;
  return formId ? <form id={formId} onSubmit={onSubmit} className={className}>{content}</form> : <div className={className}>{content}</div>;
}

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
  photos: photoScope,
  presentation = "modal",
  initialLineId,
}: {
  access: CustomReviewAccess;
  product: Pick<Product, "title"> & Partial<Pick<Product, "options">> & { featuredImage: Product["featuredImage"] | null };
  open: boolean;
  onClose: () => void;
  /** `lineId` is null for a review written without a matching order. */
  onSubmit: (review: CustomReviewSubmission) => Promise<CustomReviewResult>;
  edit?: CustomReviewEdit;
  photos?: ReviewPhotoEditorScope;
  /** On `page`, a successful submit leaves closing to the caller, which shows its own confirmation. */
  presentation?: CustomReviewPresentation;
  /** Preselect one of several purchases, such as the order a Ready to Review card linked from. */
  initialLineId?: string;
}) {
  const formId = useId();
  const ratingField = useRef<HTMLDivElement>(null);
  const ready = access.status === "ready" ? access : null;
  const photos = useReviewPhotos(ready ? photoScope : undefined, open);
  const freshDraft = (): Draft => ({
    lineId: ready?.purchases.length === 1 ? ready.purchases[0].lineId
      : ready?.purchases.some((purchase) => purchase.lineId === initialLineId) ? initialLineId! : "",
    rating: edit?.initial.rating ?? null,
    title: edit?.initial.title ?? "",
    body: edit?.initial.body ?? "",
    nameStyle: edit?.initial.nameStyle ?? ready?.defaultNameStyle ?? "first-initial",
  });
  const [draft, setDraft] = useState<Draft>(freshDraft);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const nameChoices = edit?.nameChoices ?? (ready ? REVIEW_NAME_STYLES.map((style) => ({ style, displayName: reviewDisplayName(style, ready.buyer) })) : []);
  // A single purchase is implied. A server refresh can change access without
  // remounting, so the selected purchase is derived rather than stored.
  const lineId = ready?.purchases.some((purchase) => purchase.lineId === draft.lineId) ? draft.lineId
    : ready?.purchases.length === 1 ? ready.purchases[0].lineId : "";
  const publicName = nameChoices.find((choice) => choice.style === draft.nameStyle)?.displayName ?? "";

  function close() {
    if (pending) return;
    setError("");
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || pending || (photoScope && !photos.ready)) return;
    const verified = ready.purchases.length > 0;
    if (verified && !lineId) return setError("Choose which purchase you're reviewing.");
    if (!draft.rating) {
      setError("Choose a rating before submitting your review.");
      ratingField.current?.querySelector("input")?.focus();
      return;
    }
    const review = reviewSubmissionSchema({ rating: draft.rating, title: draft.title, body: draft.body, nameStyle: draft.nameStyle });
    if (!review) return setError(`Give your review a title of up to ${REVIEW_TITLE_MAX} characters, and write it in ${REVIEW_BODY_MAX.toLocaleString("en-US")} characters or fewer.`);
    setPending(true);
    setError("");
    try {
      if (photoScope && !await photos.prepare()) return;
      const result = await onSubmit({ ...review, lineId: verified ? lineId : null,
        ...(photoScope ? {photoIds:photos.photoIds, viewerKey:photoScope.viewerKey} : {}) });
      if (!result.ok) { if (result.refreshRequired) photos.invalidate(result.error); return setError(result.error); }
      if (photoScope) photos.complete();
      if (!edit) setDraft(freshDraft());
      if (presentation === "modal") onClose();
    } catch {
      setError("Your review could not be submitted. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const productCard = (note?: ReactNode) => (
    <div className="flex items-center gap-4 rounded-xl border border-black/10 p-3 dark:border-white/10">
      {product.featuredImage && <Image src={product.featuredImage.url} alt="" width={56} height={56} sizes="56px" className="h-14 w-14 shrink-0 rounded-lg object-cover" />}
      <div className="min-w-0 space-y-1">
        <Text className="wrap-anywhere font-semibold">{product.title}</Text>
        {note}
      </div>
    </div>
  );

  if (!ready) {
    const copy = CLOSED_COPY[access.status as keyof typeof CLOSED_COPY];
    // A page has nothing to close back to, so its dismissal goes back instead.
    const dismissLabel = presentation === "page" ? "Go back" : "Close";
    const actions = access.status === "reviewed" ? (
      <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
        <Button type="button" variant="secondary" size="md" className="w-full sm:w-auto" onClick={close}>{dismissLabel}</Button>
        <Button.Link href="/reviews/mine" size="md" className="w-full sm:w-auto">My reviews</Button.Link>
      </div>
    ) : access.status === "signed-out" ? (
      <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
        <Button type="button" variant="secondary" size="md" className="w-full sm:w-auto" onClick={close}>Not now</Button>
        <Button.Link href={access.signInUrl} rel={reviewSignInRel} prefetch={false} size="md" className="w-full sm:w-auto">Sign in</Button.Link>
      </div>
    ) : (
      <ModalActions confirmLabel={dismissLabel} onConfirm={close} />
    );
    const body = <>
      {productCard()}
      <Text>{copy.body}</Text>
      {access.status === "signed-out" && <Text className="text-sm">{signInExplanation.newHere}</Text>}
    </>;
    if (presentation === "page") return <ReviewPage title={copy.title} actions={actions}>{body}</ReviewPage>;
    return (
      <Modal open={open} setIsOpen={(next) => !next && close()} title={copy.title} size="md" bodyClassName="space-y-5" actions={actions}>
        {body}
      </Modal>
    );
  }

  // The same labelled rows as the Ready to Review cards; an older caller without an order name keeps the one-line label.
  const purchaseDetails = (purchase: ReviewablePurchase) => purchase.orderLabel ? <ReviewItemDetails rows={[
    ...variantRows(purchase.options ?? variantOptions(purchase.variantTitle ?? null, product.options?.map((option) => option.name) ?? [])),
    { label: "Order", value: <span className="font-mono">{purchase.orderLabel}</span> },
  ]} /> : <Text className="text-sm wrap-anywhere">Reviewing <span className="font-semibold">{purchase.label}</span></Text>;
  const purchaseNote = ready.purchases.length === 1 ? purchaseDetails(ready.purchases[0]) : ready.purchases.length === 0 ? (
    <Text className="text-sm">We didn&apos;t find an order for this on your account, so your review shows without the Verified badge.</Text>
  ) : null;

  const title = edit ? "Edit your review" : "Write a review";
  const description = edit ? "Changes are checked before they go up. Until then, your current review stays as it is." : undefined;
  const supportingActions = <Text className="text-sm">We check every review before it goes up.<br />Your order details and email stay private.</Text>;
  const actions = <ModalActions onCancel={close} confirmForm={formId} confirmLabel={edit ? "Save changes" : "Submit review"}
    confirmDisabled={Boolean(photoScope && !photos.ready)} confirmTooltip={photoScope && !photos.ready ? "Finish preparing your photos, remove any that failed, or refresh if your account changed." : undefined}
    pending={pending} pendingLabel={edit ? "Saving" : "Submitting"} />;
  const body = <>
    <fieldset disabled={pending} aria-busy={pending} className="min-w-0 space-y-5">
      <legend className="sr-only">Your review</legend>
      <div className={ready.purchases.length > 1 ? "grid gap-5 lg:grid-cols-2 lg:items-end" : undefined}>
        {productCard(purchaseNote)}
        {ready.purchases.length > 1 && (
          <DropdownSelect
            label="Purchase"
            variant="field"
            required
            value={lineId}
            disabled={pending}
            onChange={(lineId) => setDraft((value) => ({ ...value, lineId }))}
            options={[{ value: "", label: "Choose a purchase" }, ...ready.purchases.map((purchase) => ({ value: purchase.lineId, label: purchase.label }))]}
          />
        )}
      </div>
      <div className={photoScope ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-8" : undefined}>
        <div className="min-w-0 space-y-5">
          <div ref={ratingField} onInvalid={() => setError("Choose a rating before submitting your review.")}>
            <StarRating label="Rating" name={`${formId}-rating`} required disabled={pending} value={draft.rating} onChange={(rating) => setDraft((value) => ({ ...value, rating }))} />
          </div>
          <Input label="Title" name={`${formId}-title`} required maxLength={REVIEW_TITLE_MAX} placeholder="Sum it up, Ryan" value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} />
          <Textarea id={`${formId}-body`} label="Review" name="body" required maxLength={REVIEW_BODY_MAX} placeholder="The good, the bad, the very Ryan. How's it fitting, and how's it holding up?" resizable={false} value={draft.body} onChange={(event) => setDraft((value) => ({ ...value, body: event.target.value }))} />
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
        </div>
        {photoScope && <ReviewPhotoField photos={photos} disabled={pending} rejected={photoScope.review?.rejectedPhotos} />}
      </div>
    </fieldset>
    {error && <ErrorCallout>{error}</ErrorCallout>}
  </>;

  if (presentation === "page") {
    return <ReviewPage title={title} description={description} wide={Boolean(photoScope)} formId={formId} onSubmit={submit}
      actions={actions} supportingActions={supportingActions}>{body}</ReviewPage>;
  }
  return (
    <Modal
      open={open}
      setIsOpen={(next) => !next && close()}
      title={title}
      // Photos get their own column from `lg`, so the form never grows into a tall single column.
      size={photoScope ? "xl" : "lg"}
      description={description}
      closable={!pending}
      formId={formId}
      onSubmit={submit}
      bodyClassName="space-y-5"
      supportingActions={supportingActions}
      actions={actions}
    >
      {body}
    </Modal>
  );
}
